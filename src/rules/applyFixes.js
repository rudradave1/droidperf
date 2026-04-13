'use strict';

const path = require('path');
const fs = require('fs/promises');
const { ensureDir, writeFileAtomic } = require('../utils/fs');
const { parseGradleProperties, getProp, setProp, stringifyGradleProperties } = require('../utils/gradleProperties');
const { patchGradleJvmargs } = require('../utils/jvmargs');
const { unifiedDiff } = require('../utils/diff');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}

async function backupFile({ projectPath, filePath, content }) {
  const backupDir = path.join(projectPath, '.droidperf-backup');
  await ensureDir(backupDir);
  const ts = timestamp();
  const base = path.basename(filePath);
  const backupPath = path.join(backupDir, `${base}.${ts}.bak`);
  await fs.writeFile(backupPath, content, 'utf8');
  return backupPath;
}

async function applyFixes({ project, results, dryRun }) {
  const applied = [];

  const fixes = results
    .filter((r) => r.status === 'fail' && r.fix)
    .map((r) => ({ ruleId: r.id, title: r.title, fix: r.fix }));

  if (fixes.length === 0) return { applied, backups: [] };

  const backups = [];
  const diffs = [];

  // Currently all safe fixes are gradle.properties edits.
  const gradleProps = project.gradleProperties;
  if (!gradleProps) {
    // Nothing we can safely write if gradle.properties is absent.
    return { applied, backups };
  }

  const parsed = parseGradleProperties(gradleProps.text);
  const beforeText = gradleProps.text;

  for (const f of fixes) {
    if (f.fix.type !== 'gradle.properties') continue;
    for (const [k, v] of Object.entries(f.fix.set || {})) {
      setProp(parsed, k, v);
    }
    for (const [k, patch] of Object.entries(f.fix.patch || {})) {
      if (k === 'org.gradle.jvmargs' && patch && patch.kind === 'jvmargs') {
        const current = getProp(parsed, k) || '';
        const next = patchGradleJvmargs(current, {
          xmxMb: patch.xmxMb,
          ensureFileEncodingUtf8: Boolean(patch.ensureFileEncodingUtf8),
        });
        setProp(parsed, k, next);
      }
    }
    applied.push({ ruleId: f.ruleId, title: f.title, target: 'gradle.properties' });
  }

  const afterText = stringifyGradleProperties(parsed);
  if (afterText !== beforeText) {
    if (!dryRun) {
      const backupPath = await backupFile({
        projectPath: project.projectPath,
        filePath: gradleProps.path,
        content: beforeText,
      });
      backups.push({ file: gradleProps.path, backupPath });
      await writeFileAtomic(gradleProps.path, afterText);
    }
    diffs.push(
      unifiedDiff({
        filePath: path.relative(project.projectPath, gradleProps.path) || 'gradle.properties',
        beforeText,
        afterText,
      })
    );
  }

  return { applied, backups, diffs, before: { gradleProperties: beforeText }, after: { gradleProperties: afterText } };
}

module.exports = { applyFixes };

