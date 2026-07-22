'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs/promises');
const { startServer } = require('../src/server');

test('API Server - endpoints end-to-end integration', async (t) => {
  const serverInstance = await startServer(0);
  const port = serverInstance.port;
  const baseUrl = `http://localhost:${port}`;

  // Create a temporary workspace inside the repository for test safety
  const tempDir = path.join(__dirname, '..', `test-temp-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  // Copy groovy-basic fixture contents recursively to tempDir
  const fixtureSrc = path.join(__dirname, 'fixtures', 'groovy-basic');
  await fs.cp(fixtureSrc, tempDir, { recursive: true });

  try {
    await t.test('POST /api/analyze-log returns metrics and expert knowledge report', async () => {
      const payload = {
        logContent: `
Configure project : > 1.5s
:app:compileDebugJavaWithJavac took 4.5s
BUILD SUCCESSFUL in 10s
        `,
        useAI: false
      };

      const res = await fetch(`${baseUrl}/api/analyze-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.metrics);
      assert.equal(data.metrics.buildStatus, 'SUCCESS');
      assert.equal(data.metrics.totalTime, '10s');
      assert.ok(data.reportMarkdown);
      assert.ok(data.reportMarkdown.includes('Build Performance Analysis'));
    });

    await t.test('GET /how-it-works serves the onboarding page', async () => {
      const res = await fetch(`${baseUrl}/how-it-works`);
      assert.equal(res.status, 200);
      const page = await res.text();
      assert.match(page, /How droidperf works/i);
    });

    await t.test('GET /api/project returns correct performance rules evaluation', async () => {
      const res = await fetch(`${baseUrl}/api/project?path=${encodeURIComponent(tempDir)}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.projectPath, tempDir);
      assert.ok(data.healthScore < 100); // fails configuration cache, parallel, etc.
      
      const cachingRule = data.results.find(r => r.id === 'build-cache');
      assert.ok(cachingRule);
      assert.equal(cachingRule.status, 'fail');
    });

    await t.test('POST /api/fix applies fixes, verifies successfully, and updates files', async () => {
      const payload = {
        path: tempDir,
        verify: false,
        fixes: [
          {
            type: 'gradle.properties',
            property: 'org.gradle.caching',
            value: 'true'
          },
          {
            type: 'gradle.properties',
            property: 'org.gradle.parallel',
            value: 'true'
          }
        ]
      };

      const res = await fetch(`${baseUrl}/api/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.applied.length >= 1);

      // Verify the file actually changed
      const propsContent = await fs.readFile(path.join(tempDir, 'gradle.properties'), 'utf8');
      assert.ok(propsContent.includes('org.gradle.caching=true'));
      assert.ok(propsContent.includes('org.gradle.parallel=true'));
    });

    await t.test('POST /api/fix fails verification and rolls back on broken syntax/config', async () => {
      // Create a corrupted settings.gradle file that will cause gradle verification to fail
      await fs.writeFile(path.join(tempDir, 'settings.gradle'), 'invalid_groovy_syntax_garbage()!!!');

      const payload = {
        path: tempDir,
        fixes: [
          {
            type: 'gradle.properties',
            property: 'org.gradle.configuration-cache',
            value: 'true'
          }
        ]
      };

      const res = await fetch(`${baseUrl}/api/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Verification should fail, returning 422
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.ok(data.error.includes('Verification failed'));

      // Check that org.gradle.configuration-cache was rolled back
      const propsContent = await fs.readFile(path.join(tempDir, 'gradle.properties'), 'utf8');
      assert.equal(propsContent.includes('org.gradle.configuration-cache=true'), false);
    });

  } finally {
    await serverInstance.close();
    // Clean up temporary workspace directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
