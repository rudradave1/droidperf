'use strict';

const fs = require('fs/promises');
const path = require('path');
const chalk = require('chalk');
const { getGlobalApiKey } = require('../config/globalConfig');
const { pathExists, backupFile, writeFileAtomic } = require('../utils/fs');
const { parseGradleProperties, setProp, stringifyGradleProperties } = require('../utils/gradleProperties');
const { unifiedDiff } = require('../utils/diff');
const { parseGradleLog } = require('../utils/logParser');
const { getRelevantKnowledge } = require('../knowledge/gradlePatterns');

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

function extractFixJson(text) {
  try {
    // 1. Try extracting between FIX_JSON and markdown code blocks
    const match = text.match(/FIX_JSON\s*```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }

    // 2. Fallback: find the first { ... } after FIX_JSON
    const markerIdx = text.lastIndexOf('FIX_JSON');
    if (markerIdx !== -1) {
      const searchArea = text.slice(markerIdx);
      const jsonMatch = searchArea.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim());
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function analyzeCommand(opts) {
  const { buildLog: buildLogOpt, apiKey: apiKeyOpt, model: modelOpt, apply, dryRun } = opts;

  let apiKey = apiKeyOpt || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = await getGlobalApiKey();
  }

  if (!apiKey) {
    console.error(chalk.red('\nNo API key found.'));
    console.log('\nGet a free OpenRouter key in 2 minutes:');
    console.log(chalk.cyan('→ https://openrouter.ai/keys'));
    console.log('\nThen run:');
    console.log(chalk.white('npx droidperf analyze --api-key YOUR_KEY'));
    console.log('\nOr set it once and never type it again:');
    console.log(chalk.white('npx droidperf config --set-key YOUR_KEY\n'));
    process.exitCode = 1;
    return;
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
  const expertKnowledge = getRelevantKnowledge(logContent);

  console.log(chalk.blue(`🚀 Analyzing with OpenRouter LLM (${modelOpt || 'openrouter/auto'})...`));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/rudradave1/droidperf',
        'X-Title': 'droidperf',
      },
      body: JSON.stringify({
        model: modelOpt || 'openrouter/auto',
        messages: [
          {
            role: 'system',
            content: `You are an Android build performance expert. Analyze the provided build metrics and relevant expert knowledge to find bottlenecks.

Expert Knowledge for this build:
${expertKnowledge.map(k => `- ${k}`).join('\n') || 'None specificly identified.'}

You must end your response with a FIX_JSON block in this exact format, no exceptions:

FIX_JSON
\`\`\`json
{
  "fixes": [
    {"property": "org.gradle.parallel", "value": "true"},
    {"property": "org.gradle.caching", "value": "true"}
  ]
}
\`\`\`
Do not add any text after the FIX_JSON block.`,
          },
          {
            role: 'user',
            content: `Analyze these build metrics and find the top 3 bottlenecks.

Build Summary: ${buildMetrics.summary}
Configuration Time: ${buildMetrics.configTime || 'Unknown'}
Total Time: ${buildMetrics.totalTime || 'Unknown'}

Slowest Tasks:
${buildMetrics.slowTasks.map(t => `- ${t.path}: ${t.duration}s`).join('\n')}

Detected Warnings:
${buildMetrics.warnings.map(w => `- ${w}`).join('\n') || 'None'}

Provide an exact fix for each bottleneck with a code snippet and estimated time saved.

Target format:
Top 3 bottlenecks found
1. [Bottleneck Name]
   - Fix: [Description]
   - Code: [Snippet]
   - Saved: [Time]
2. ...
3. ...`,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const fullContent = data.choices[0].message.content;

    // Split report from JSON
    const jsonMarker = 'FIX_JSON';
    const markerIdx = fullContent.lastIndexOf(jsonMarker);
    const result = markerIdx !== -1 ? fullContent.slice(0, markerIdx).trim() : fullContent;

    console.log('\n' + result);

    const reportPath = path.join(process.cwd(), 'droidperf-report.md');
    const reportHeader = `# Droidperf Build Analysis Report\nGenerated on: ${new Date().toLocaleString()}\nLog source: ${logPath}\n\n`;
    await fs.writeFile(reportPath, reportHeader + result, 'utf8');

    console.log(chalk.green(`\n✅ Report saved to ${chalk.bold(reportPath)}`));

    if (apply || dryRun) {
      const fixesObj = extractFixJson(fullContent);

      if (!fixesObj || !Array.isArray(fixesObj.fixes)) {
        console.log(chalk.yellow('\n⚠️  Could not auto-apply fixes. Check droidperf-report.md for manual steps.'));
        return;
      }

      const fixes = fixesObj.fixes;
      if (fixes.length > 0) {
        const projectPath = process.cwd();
        const gpPath = path.join(projectPath, 'gradle.properties');

        if (await pathExists(gpPath)) {
          const content = await fs.readFile(gpPath, 'utf8');
          const parsed = parseGradleProperties(content);
          for (const fix of fixes) {
            const { property, value } = fix;
            if (apply) console.log(chalk.white(`✍️  Applying fix: ${property}=${value}... done`));
            setProp(parsed, property, value);
          }
          const updatedContent = stringifyGradleProperties(parsed);

          if (dryRun) {
            const diff = unifiedDiff({
              filePath: 'gradle.properties',
              beforeText: content,
              afterText: updatedContent,
              context: 3
            });
            console.log(chalk.cyan('\n🔍 Dry run: Preview of changes to gradle.properties:'));
            console.log(diff);
          } else {
            const backupPath = await backupFile({ projectPath, filePath: gpPath, content });
            console.log(chalk.cyan(`\n✅ Backup created: ${path.basename(backupPath)}`));
            await writeFileAtomic(gpPath, updatedContent);
            console.log(chalk.green('\n🎉 Done. Run ./gradlew build to verify improvements.'));
          }
        } else {
          console.log(chalk.yellow('\nCould not find gradle.properties to apply fixes.'));
        }
      } else {
        console.log(chalk.yellow('\nNo automatic fixes could be extracted for this report.'));
      }
    } else {
      console.log(chalk.gray('\nTip: Run with --apply to automatically write recommended gradle.properties changes.'));
      console.log(chalk.gray('Use --dry-run with --apply to preview changes first.'));
    }

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(chalk.red(`\n❌ Error: Analysis timed out after 60 seconds.`));
    } else {
      console.error(chalk.red(`\n❌ Error during analysis: ${err.message}`));
    }
    process.exitCode = 1;
  }
}

module.exports = { analyzeCommand };
