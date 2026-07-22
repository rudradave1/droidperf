'use strict';

const path = require('path');
const fs = require('fs/promises');
const { ensureDir, writeFileAtomic, backupFile, pathExists } = require('../utils/fs');
const { parseGradleProperties, getProp, setProp, stringifyGradleProperties } = require('../utils/gradleProperties');
const { patchGradleJvmargs } = require('../utils/jvmargs');
const { unifiedDiff } = require('../utils/diff');

function lineCount(text) {
  if (!text) return 0;
  return String(text).split(/\r?\n/).length;
}

async function applyFixes({ project, results, dryRun }) {
  const applied = [];
  const backups = [];
  const diffs = [];

  const fixes = results
    .filter((r) => r.status === 'fail' && r.fix)
    .map((r) => ({ ruleId: r.id, title: r.title, fix: r.fix }));

  if (fixes.length === 0) return { applied, backups, diffs };

  // Keep track of modified files in memory
  // Key: absolute file path. Value: { beforeText, afterText }
  const fileChanges = new Map();

  const getOrCreateFileState = async (filePath) => {
    if (fileChanges.has(filePath)) {
      return fileChanges.get(filePath);
    }
    let text = '';
    if (await pathExists(filePath)) {
      text = await fs.readFile(filePath, 'utf8');
    }
    const state = { beforeText: text, afterText: text };
    fileChanges.set(filePath, state);
    return state;
  };

  // 1. Process gradle.properties edits
  const gpPath = project.gradleProperties
    ? project.gradleProperties.path
    : path.join(project.projectPath, 'gradle.properties');

  const gpFixes = fixes.filter((f) => f.fix.type === 'gradle.properties');
  if (gpFixes.length > 0) {
    const state = await getOrCreateFileState(gpPath);
    const parsed = parseGradleProperties(state.afterText);

    for (const f of gpFixes) {
      let appliedThis = false;
      if (f.fix.set) {
        for (const [k, v] of Object.entries(f.fix.set)) {
          setProp(parsed, k, v);
          appliedThis = true;
        }
      }
      if (f.fix.patch) {
        for (const [k, patch] of Object.entries(f.fix.patch)) {
          if (k === 'org.gradle.jvmargs' && patch && patch.kind === 'jvmargs') {
            const current = getProp(parsed, k) || '';
            const next = patchGradleJvmargs(current, {
              xmxMb: patch.xmxMb,
              ensureFileEncodingUtf8: Boolean(patch.ensureFileEncodingUtf8),
            });
            setProp(parsed, k, next);
            appliedThis = true;
          }
        }
      }
      if (appliedThis) {
        applied.push({ ruleId: f.ruleId, title: f.title, target: 'gradle.properties' });
      }
    }
    state.afterText = stringifyGradleProperties(parsed);
  }

  // 2. Process general file edits
  const fileEdits = fixes.filter((f) => f.fix.type === 'file_edit');
  for (const f of fileEdits) {
    const relativePath = f.fix.path;
    if (!relativePath) continue;
    const absPath = path.resolve(project.projectPath, relativePath);
    const state = await getOrCreateFileState(absPath);

    if (f.fix.action === 'replace') {
      const target = f.fix.target;
      const replacement = f.fix.replacement;
      if (state.afterText.includes(target)) {
        // Replace all occurrences to be thorough, but could be specific
        state.afterText = state.afterText.split(target).join(replacement);
        applied.push({
          ruleId: f.ruleId,
          title: f.title,
          target: path.basename(absPath),
          filePath: relativePath
        });
      }
    }
  }

  // 3. Write updates, generate diffs & backups
  for (const [filePath, state] of fileChanges.entries()) {
    const { beforeText, afterText } = state;
    if (afterText === beforeText) continue;

    const relativeDisplayPath = path.relative(project.projectPath, filePath);

    if (!dryRun) {
      const backupPath = await backupFile({
        projectPath: project.projectPath,
        filePath,
        content: beforeText,
      });
      backups.push({ file: filePath, backupPath });
      await ensureDir(path.dirname(filePath));
      await writeFileAtomic(filePath, afterText);
    }

    diffs.push(
      unifiedDiff({
        filePath: relativeDisplayPath,
        beforeText,
        afterText,
        context: dryRun ? Math.max(lineCount(beforeText), lineCount(afterText)) : 3,
      })
    );
  }

  return {
    applied,
    backups,
    diffs,
    fileChanges: Object.fromEntries(
      Array.from(fileChanges.entries()).map(([k, v]) => [path.relative(project.projectPath, k), v])
    )
  };
}

module.exports = { applyFixes };
