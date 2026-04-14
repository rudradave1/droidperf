'use strict';

const path = require('path');
const chalk = require('chalk');
const { runRules } = require('../rules/runRules');
const { applyFixes } = require('../rules/applyFixes');
const { formatFixReport } = require('../ui/formatFixReport');
const { loadDroidperfConfig } = require('../config/loadConfig');
const { resolveGradleProjectPath } = require('../project/resolveGradleProjectPath');

const { spawnSync } = require('child_process');

function parseCsvIds(v) {
  if (!v) return null;
  const parts = String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? new Set(parts) : null;
}

function runAssembleDebug(dir) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'gradlew.bat' : './gradlew';
  const t0 = Date.now();
  spawnSync(cmd, ['assembleDebug'], { cwd: dir, stdio: 'ignore' });
  return Date.now() - t0;
}

async function fixCommand({ projectPath, dryRun, json, color, only, exclude, configPath, measure }) {
  const absProjectPath = path.resolve(projectPath);
  const resolved = await resolveGradleProjectPath(absProjectPath);
  const cfg = await loadDroidperfConfig(resolved.resolvedPath, configPath);
  const project = resolved.project;
  let results = runRules(project, { config: cfg.config });

  const onlySet = parseCsvIds(only);
  const excludeSet = parseCsvIds(exclude);
  if (onlySet) results = results.filter((r) => onlySet.has(r.id));
  if (excludeSet) results = results.filter((r) => !excludeSet.has(r.id));

  let baselineTime = 0;
  if (measure && !dryRun) {
    // eslint-disable-next-line no-console
    console.log(color ? chalk.cyan('Running baseline build (this may take a few minutes)...') : 'Running baseline build...');
    baselineTime = runAssembleDebug(resolved.resolvedPath);
  }

  const applied = await applyFixes({
    project,
    results,
    dryRun,
  });
  
  let afterTime = 0;
  if (measure && !dryRun) {
    // eslint-disable-next-line no-console
    console.log(color ? chalk.cyan('Running post-fix build (this may take a few minutes)...') : 'Running post-fix build...');
    afterTime = runAssembleDebug(resolved.resolvedPath);
  }

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
          measure: measure ? { baselineTime, afterTime } : null
        },
        null,
        2
      )
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(formatFixReport({ projectPath: absProjectPath, results, applied, dryRun, chalk: color ? chalk : null, measureDetails: measure && !dryRun ? { baselineTime, afterTime } : null }));
  }

  process.exitCode = 0;
}

module.exports = { fixCommand };

