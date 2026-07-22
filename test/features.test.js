'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs/promises');
const { parseGradleLog } = require('../src/utils/logParser');
const { getRelevantKnowledge } = require('../src/knowledge/gradlePatterns');
const { applyFixes } = require('../src/rules/applyFixes');
const { startServer } = require('../src/server');

test('logParser - multi-locale parsing and noise task filtering', () => {
  const log = `
Configure project : > 1.5s
Configure project :feature:module > 0.8s
:app:preBuild UP-TO-DATE
:app:compileDebugJavaWithJavac took 4.5s
:app:kaptGenerateStubsDebug took 1.2s
:feature:module:minifyDebugWithR8 took 12.3s
BUILD SUCCESSFUL in 25s
`;

  const res = parseGradleLog(log);

  assert.equal(res.buildStatus, 'SUCCESS');
  assert.equal(res.totalTime, '25s');
  assert.equal(res.configTime, '2.3s'); // 1.5 + 0.8
  
  // Verify compilation and R8 tasks are parsed
  const javaTask = res.slowTasks.find(t => t.path === ':app:compileDebugJavaWithJavac');
  const r8Task = res.slowTasks.find(t => t.path === ':feature:module:minifyDebugWithR8');
  assert.ok(javaTask);
  assert.equal(javaTask.duration, 4.5);
  assert.ok(r8Task);
  assert.equal(r8Task.duration, 12.3);

  // Verify noise task (preBuild) is excluded from slowTasks list
  const preBuildTask = res.slowTasks.find(t => t.path === ':app:preBuild');
  assert.equal(preBuildTask, undefined);
});

test('logParser - handles build failure details', () => {
  const log = `
:app:compileDebugJavaWithJavac FAILED

* What went wrong:
Execution failed for task ':app:compileDebugJavaWithJavac'.
> Compilation error in MainActivity.java

BUILD FAILED in 5s
`;

  const res = parseGradleLog(log);
  assert.equal(res.buildStatus, 'FAILED');
  assert.equal(res.totalTime, '5s');
  assert.ok(res.failureDetails.includes('MainActivity.java'));
});

test('gradlePatterns - getRelevantKnowledge maps keywords correctly', () => {
  const logContent = 'Warning: android.enableJetifier=true is deprecated. Expiring Daemon because JVM heap space is exhausted.';
  const advice = getRelevantKnowledge(logContent);

  const hasHeapAdvice = advice.some(a => a.includes('JVM max heap'));
  const hasJetifierAdvice = advice.some(a => a.includes('Jetifier'));

  assert.ok(hasHeapAdvice);
  assert.ok(hasJetifierAdvice);
});

test('applyFixes - processes file_edit replacements and outputs diffs', async () => {
  // Create dummy workspace structure
  const tmpDir = path.join(__dirname, '..', 'artifacts', 'test-workspace-' + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });
  
  const buildGradlePath = path.join(tmpDir, 'build.gradle');
  await fs.writeFile(buildGradlePath, 'minifyEnabled false\nshrinkResources false', 'utf8');

  const project = {
    projectPath: tmpDir,
    gradleProperties: null,
    buildFiles: [{ path: buildGradlePath, text: 'minifyEnabled false\nshrinkResources false' }]
  };

  const results = [
    {
      id: 'enable-minify',
      title: 'Enable R8 Minification',
      status: 'fail',
      fix: {
        type: 'file_edit',
        path: 'build.gradle',
        action: 'replace',
        target: 'minifyEnabled false',
        replacement: 'minifyEnabled true'
      }
    }
  ];

  const appliedResult = await applyFixes({
    project,
    results,
    dryRun: false
  });

  assert.equal(appliedResult.applied.length, 1);
  assert.equal(appliedResult.applied[0].ruleId, 'enable-minify');

  // Verify file got written
  const updatedContent = await fs.readFile(buildGradlePath, 'utf8');
  assert.ok(updatedContent.includes('minifyEnabled true'));
  assert.ok(updatedContent.includes('shrinkResources false'));

  // Clean up
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('webServer - starts and responds on dynamic port', async () => {
  const serverInstance = await startServer(0);
  const port = serverInstance.port;
  const fixturePath = path.join(__dirname, 'fixtures', 'groovy-basic');

  // Send a simple project info request
  try {
    const res = await fetch(`http://localhost:${port}/api/project?path=${encodeURIComponent(fixturePath)}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.projectPath);
    assert.ok(Array.isArray(data.results));
  } catch (err) {
    assert.fail('Failed to connect or fetch from the local UI server: ' + err.message);
  } finally {
    await serverInstance.close();
  }
});
