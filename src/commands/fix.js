'use strict';

const path = require('path');
const chalk = require('chalk');
const { runRules } = require('../rules/runRules');
const { applyFixes } = require('../rules/applyFixes');
const { formatFixReport } = require('../ui/formatFixReport');
const { loadDroidperfConfig } = require('../config/loadConfig');
const { resolveGradleProjectPath } = require('../project/resolveGradleProjectPath');

function parseCsvIds(v) {
  if (!v) return null;
  const parts = String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? new Set(parts) : null;
}

async function fixCommand({ projectPath, dryRun, json, color, only, exclude, configPath }) {
  const absProjectPath = path.resolve(projectPath);
  const resolved = await resolveGradleProjectPath(absProjectPath);
  const cfg = await loadDroidperfConfig(resolved.resolvedPath, configPath);
  const project = resolved.project;
  let results = runRules(project, { config: cfg.config });

  const onlySet = parseCsvIds(only);
  const excludeSet = parseCsvIds(exclude);
  if (onlySet) results = results.filter((r) => onlySet.has(r.id));
  if (excludeSet) results = results.filter((r) => !excludeSet.has(r.id));

  const applied = await applyFixes({
    project,
    results,
    dryRun,
  });

  if (json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          projectPath: resolved.resolvedPath,
          inferred: resolved.inferred || null,
          configPath: cfg.path,
          dryRun: Boolean(dryRun),
          results,
          applied,
        },
        null,
        2
      )
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(formatFixReport({ projectPath: absProjectPath, results, applied, dryRun, chalk: color ? chalk : null }));
  }

  process.exitCode = 0;
}

module.exports = { fixCommand };

