'use strict';

const fs = require('fs/promises');
const path = require('path');
const chalk = require('chalk');
const { getGlobalApiKey } = require('../config/globalConfig');
const { pathExists, backupFile, writeFileAtomic, getGradleCommand } = require('../utils/fs');
const { parseGradleLog } = require('../utils/logParser');
const { getRelevantKnowledge } = require('../knowledge/gradlePatterns');
const { loadProjectFiles } = require('../project/loadProjectFiles');
const { resolveGradleProjectPath } = require('../project/resolveGradleProjectPath');
const { applyFixes } = require('../rules/applyFixes');
const { analyzeBuildLog } = require('../analysis/analysisService');
const { extractFixJson } = require('../analysis/fixJson');
const { spawnSync } = require('child_process');

async function findBuildLog(searchDir) {
  const candidates = [
    'build.log',
    'gradle.log',
    path.join('build', 'build.log'),
  ];

  for (const c of candidates) {
    const p = path.resolve(searchDir, c);
    if (await pathExists(p)) return p;
  }
  return null;
}

async function analyzeCommand(opts) {
  const { buildLog: buildLogOpt, apiKey: apiKeyOpt, model: modelOpt, local = true, apply, dryRun, verify, telemetryOff } = opts;

  let apiKey = apiKeyOpt || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = await getGlobalApiKey();
  }

  let project = null;
  try {
    const resolved = await resolveGradleProjectPath(process.cwd());
    project = resolved.project;
  } catch (err) {
    // Quietly ignore if not in a gradle project folder
  }

  let logPath = buildLogOpt ? path.resolve(buildLogOpt) : await findBuildLog(process.cwd());

  if (!logPath) {
    console.error(chalk.red('Error: Could not find build.log automatically.'));
    console.error('Please run your build like this first:');
    console.error(chalk.cyan('  ./gradlew assembleDebug > build.log 2>&1'));
    console.error('Or specify the path with --build-log <path>');
    process.exitCode = 1;
    return;
  }

  let logContent;
  try {
    logContent = await fs.readFile(logPath, 'utf8');
  } catch (err) {
    console.error(chalk.red(`Error: Could not read build log file at ${logPath}`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue(`🚀 Pre-processing ${path.basename(logPath)}...`));
  const buildMetrics = parseGradleLog(logContent);
  const expertKnowledge = getRelevantKnowledge(logContent, project);

  const localOnly = local || !apiKey || telemetryOff;
  if (localOnly) {
    console.log(chalk.blue(`🚀 Running local offline analysis (Local Expert mode)...`));
  } else {
    console.log(chalk.blue(`🚀 Analyzing with OpenRouter LLM (${modelOpt || 'openrouter/auto'})...`));
  }

  const analysis = await analyzeBuildLog({
    buildMetrics,
    expertKnowledge,
    apiKey,
    model: modelOpt || 'openrouter/auto',
    localOnly,
  });

  if (analysis.source === 'local' && analysis.fallbackReason) {
    console.warn(chalk.yellow(`⚠️ ${analysis.fallbackReason} Using Local Expert analysis...`));
  }

  const reportText = analysis.reportText;
  const serviceFixes = analysis.fixes;

  // Split report text from JSON
  const jsonMarker = 'FIX_JSON';
  const markerIdx = reportText.lastIndexOf(jsonMarker);
  const result = markerIdx !== -1 ? reportText.slice(0, markerIdx).trim() : reportText;

  console.log('\n' + result);

  const reportPath = path.join(process.cwd(), 'droidperf-report.md');
  const reportHeader = `# Droidperf Build Analysis Report\nGenerated on: ${new Date().toLocaleString()}\nLog source: ${logPath}\n\n`;
  await fs.writeFile(reportPath, reportHeader + result, 'utf8');

  console.log(chalk.green(`\n✅ Report saved to ${chalk.bold(reportPath)}`));

  if (apply || dryRun) {
    const extracted = extractFixJson(reportText);
    const fixesToApply = extracted?.fixes ?? serviceFixes;

    if (!fixesToApply || !Array.isArray(fixesToApply)) {
      console.log(chalk.yellow('\n⚠️  Could not auto-apply fixes. Check droidperf-report.md for manual steps.'));
      return;
    }

    const fixes = fixesToApply;
    if (fixes.length > 0) {
      if (!project) {
        console.log(chalk.yellow('\nCould not locate Android project root. Offline fixes cannot be applied.'));
        return;
      }

      // Convert extracted fixes to rules format for applyFixes
      const ruleResults = fixes.map((f, i) => {
        let fixObj;
        let title = `Auto-recommendation #${i + 1}`;
        if (f.type === 'gradle.properties') {
          if (f.property) {
            fixObj = { type: 'gradle.properties', set: { [f.property]: f.value } };
            title = `Set ${f.property} to ${f.value}`;
          } else if (f.patch) {
            fixObj = { type: 'gradle.properties', patch: f.patch };
            title = `Patch gradle.properties`;
          }
        } else if (f.type === 'file_edit') {
          fixObj = f;
          title = `Modify ${f.path}`;
        }

        return {
          id: `ai-fix-${i}`,
          title,
          status: 'fail',
          fix: fixObj
        };
      });

      const appliedResult = await applyFixes({
        project,
        results: ruleResults,
        dryRun
      });

      if (dryRun) {
        console.log(chalk.cyan('\n🔍 Dry run: Preview of recommended changes:'));
        for (const diff of appliedResult.diffs) {
          console.log(diff);
        }
      } else if (appliedResult.applied.length > 0) {
        console.log(chalk.cyan(`\n✅ Backup created for changed files.`));
        for (const f of appliedResult.applied) {
          console.log(chalk.white(`✍️  Applied: ${f.title} on ${f.target}`));
        }

        if (verify !== false) {
          // Run Verification Loop
          const cmd = await getGradleCommand(project.projectPath);
          console.log(chalk.cyan('\n🔍 Verifying build configuration...'));
          const verification = spawnSync(cmd, ['help'], {
            cwd: project.projectPath,
            stdio: 'pipe',
            encoding: 'utf8'
          });

          if (verification.status !== 0) {
            console.error(chalk.red('\n❌ Verification failed! The changes broke the Gradle build structure.'));
            console.error(chalk.red(verification.stderr || verification.stdout || 'Unknown Gradle error'));

            console.log(chalk.yellow('\nReverting changes to restore original state...'));
            for (const backup of appliedResult.backups) {
              await fs.copyFile(backup.backupPath, backup.file);
              console.log(chalk.white(`Restored: ${path.basename(backup.file)}`));
            }
            console.log(chalk.green('Revert complete. Your files have been restored safely.'));
            process.exitCode = 1;
          } else {
            console.log(chalk.green('✅ Verification successful! Your Gradle build is fully functional.'));
          }
        }
      }
    } else {
      console.log(chalk.yellow('\nNo automatic fixes could be extracted for this report.'));
    }
  } else {
    console.log(chalk.gray('\nTip: Run with --apply to automatically write recommended changes.'));
    console.log(chalk.gray('Use --dry-run with --apply to preview changes first.'));
  }
}

module.exports = { analyzeCommand };
