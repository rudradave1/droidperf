'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');

function runCli(args, { cwd } = {}) {
  const cli = path.join(__dirname, '..', 'bin', 'droidperf.js');
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [cli, ...args], { cwd }, (err, stdout, stderr) => {
      const code = err && typeof err.code === 'number' ? err.code : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

test('audit (no-color) reports issues for groovy fixture', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'groovy-basic');
  const res = await runCli(['audit', '--path', fixture, '--no-color']);
  assert.equal(res.stderr, '');
  assert.ok(res.stdout.includes('Project Health Report'));
  assert.ok(res.stdout.includes('Issues found:'));
  assert.ok(res.stdout.includes('Configuration cache disabled'));
  assert.equal(res.code, 2); // has critical
});

test('--version matches package.json', async () => {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const res = await runCli(['--version']);
  assert.equal(res.stderr, '');
  assert.equal(res.stdout.trim(), pkg.version);
});

test('audit accepts positional path argument', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'groovy-basic');
  const res = await runCli(['audit', fixture, '--no-color']);
  assert.equal(res.stderr, '');
  assert.ok(res.stdout.includes('Project Health Report'));
  assert.equal(res.code, 2);
});

test('fix --dry-run prints unified diff and does not create backups', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'groovy-basic');
  const res = await runCli(['fix', '--path', fixture, '--dry-run', '--no-color']);
  assert.equal(res.stderr, '');
  assert.ok(res.stdout.includes('Previewing fixes (dry-run)...'));
  assert.ok(res.stdout.includes('Diff:'));
  assert.ok(res.stdout.includes('gradle.properties'));
  // dry-run should not create backups directory
  const backupMention = res.stdout.includes('.droidperf-backup');
  assert.equal(backupMention, false);
});

test('audit detects version-catalog dynamic versions', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'kts-vcatalog');
  const res = await runCli(['audit', '--path', fixture, '--no-color', '--json']);
  const parsed = JSON.parse(res.stdout);
  const dynamicDeps = parsed.results.find((r) => r.id === 'dynamic-deps');
  assert.ok(dynamicDeps);
  assert.equal(dynamicDeps.status, 'fail');
  assert.equal(res.code, 2); // configuration-cache/build-cache defaults missing -> critical
});

test('audit follows includeBuild composite builds', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'composite-root');
  const res = await runCli(['audit', '--path', fixture, '--no-color', '--json']);
  const parsed = JSON.parse(res.stdout);
  const dynamicDeps = parsed.results.find((r) => r.id === 'dynamic-deps');
  assert.ok(dynamicDeps);
  assert.equal(dynamicDeps.status, 'fail');
});

test('audit auto-detects Flutter android/ subproject', async () => {
  const fixture = path.join(__dirname, 'fixtures', 'flutter-repo');
  const res = await runCli(['audit', '--path', fixture, '--no-color', '--json']);
  assert.equal(res.stderr, '');
  const parsed = JSON.parse(res.stdout);
  assert.ok(parsed.projectPath.endsWith(`${path.sep}flutter-repo${path.sep}android`));
  assert.equal(parsed.inferred?.kind, 'flutter');
  assert.equal(res.code, 2);
});
