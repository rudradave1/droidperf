'use strict';

const path = require('path');
const chalk = require('chalk');
const { runRules } = require('../rules/runRules');
const { applyFixes } = require('../rules/applyFixes');
const { formatFixReport } = require('../ui/formatFixReport');
const { loadDroidperfConfig } = require('../config/loadConfig');
const { resolveGradleProjectPath } = require('../project/resolveGradleProjectPath');
const { getGradleCommand } = require('../utils/fs');

const { spawnSync } = require('child_process');

function parseCsvIds(v) {
  if (!v) return null;
  const parts = String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? new Set(parts) : null;
}

async function runAssembleDebug(dir) {
  const cmd = await getGradleCommand(dir);
  const t0 = Date.now();
  spawnSync(cmd, ['assembleDebug'], { cwd: dir, stdio: 'ignore' });
  return Date.now() - t0;
}

async function fixCommand({ projectPath, dryRun, json, color, only, exclude, criticalOnly, configPath, measure, verify = true, autoConfirm = false }) {
  const absProjectPath = path.resolve(projectPath);
  const resolved = await resolveGradleProjectPath(absProjectPath);
  const cfg = await loadDroidperfConfig(resolved.resolvedPath, configPath);
  const project = resolved.project;
  let results = runRules(project, { config: cfg.config });

  const onlySet = parseCsvIds(only);
  const excludeSet = parseCsvIds(exclude);
  if (onlySet) results = results.filter((r) => onlySet.has(r.id));
  if (excludeSet) results = results.filter((r) => !excludeSet.has(r.id));
  if (criticalOnly) results = results.filter((r) => r.severity === 'CRITICAL');

  let baselineTime = 0;
  if (measure && !dryRun) {
    // eslint-disable-next-line no-console
    console.log(color ? chalk.cyan('Running baseline build (this may take a few minutes)...') : 'Running baseline build...');
    baselineTime = await runAssembleDebug(resolved.resolvedPath);
  }

  const applied = await applyFixes({
    project,
    results,
    dryRun,
  });

  if (dryRun || !autoConfirm) {
    const diff = applied.diff || 'No changes to apply.';
    console.log(color ? chalk.yellow('\n--- Diff Preview ---') : '\n--- Diff Preview ---');
    console.log(diff);
    
    if (!autoConfirm) {
      const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => readline.question('\nApply these changes? [y/N]: ', resolve));
      readline.close();
      if (answer.toLowerCase() !== 'y') {
        console.log('Skipped.');
        return;
      }
    }
  }

  // Apply if not already applied by first call
  if (dryRun && !autoConfirm) {
     await applyFixes({ project, results, dryRun: false });
  }

  if (!dryRun && verify && applied.applied && applied.applied.length > 0) {
    const cmd = await getGradleCommand(resolved.resolvedPath);
    console.log(color ? chalk.cyan('\n🔍 Verifying build configuration...') : '\n🔍 Verifying build configuration...');
    const verification = spawnSync(cmd, ['help'], {
      cwd: resolved.resolvedPath,
      stdio: 'pipe',
      encoding: 'utf8'
    });

    if (verification.status !== 0) {
      console.error(color ? chalk.red('\n❌ Verification failed! The changes broke the Gradle build structure.') : '\n❌ Verification failed! The changes broke the Gradle build structure.');
      console.error(color ? chalk.red(verification.stderr || verification.stdout || 'Unknown Gradle error') : (verification.stderr || verification.stdout || 'Unknown Gradle error'));

      console.log(color ? chalk.yellow('\nReverting changes to restore original state...') : '\nReverting changes to restore original state...');
      const fs = require('fs/promises');
      for (const backup of applied.backups) {
        await fs.copyFile(backup.backupPath, backup.file);
        console.log(color ? chalk.white(`Restored: ${path.basename(backup.file)}`) : `Restored: ${path.basename(backup.file)}`);
      }
      console.log(color ? chalk.green('Revert complete. Your build files have been restored safely.') : 'Revert complete. Your build files have been restored safely.');
      process.exitCode = 1;
      return;
    } else {
      console.log(color ? chalk.green('✅ Verification successful! Your Gradle build is fully functional.') : '✅ Verification successful! Your Gradle build is fully functional.');
    }
  }
  
  let afterTime = 0;
  if (measure && !dryRun) {
    // eslint-disable-next-line no-console
    console.log(color ? chalk.cyan('Running post-fix build (this may take a few minutes)...') : 'Running post-fix build...');
    afterTime = await runAssembleDebug(resolved.resolvedPath);
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

