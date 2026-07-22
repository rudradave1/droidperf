#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { auditCommand } = require('../src/commands/audit');
const { fixCommand } = require('../src/commands/fix');
const { analyzeCommand } = require('../src/commands/analyze');
const { configCommand } = require('../src/commands/config');
const { version } = require('../package.json');

program
  .name('droidperf')
  .description('Android build performance audit tool')
  .version(version);

program
  .command('audit')
  .argument('[path]', 'Project path (optional)')
  .description('Audit an Android project for build performance issues.')
  .option('--path <path>', 'Project path', process.cwd())
  .option('--config <path>', 'Path to droidperf config (JSON)')
  .option('--json', 'Output JSON', false)
  .option('--no-color', 'Disable colored output')
  .option('--list-rules', 'List available rules (JSON)')
  .option('--ci', 'Run in CI mode (fail build if performance misconfigurations detected)')
  .action(async (argPath, opts) => {
    await auditCommand({
      projectPath: argPath || opts.path,
      configPath: opts.config,
      json: Boolean(opts.json),
      color: Boolean(opts.color),
      listRules: Boolean(opts.listRules),
      ci: Boolean(opts.ci),
    });
  });

program
  .command('fix')
  .argument('[path]', 'Project path (optional)')
  .description('Apply safe performance fixes to an Android project.')
  .option('--path <path>', 'Project path', process.cwd())
  .option('--config <path>', 'Path to droidperf config (JSON)')
  .option('--dry-run', 'Preview fixes without writing files', false)
  .option('--json', 'Output JSON', false)
  .option('--no-color', 'Disable colored output')
  .option('--only <ruleIds>', 'Comma-separated rule IDs to apply')
  .option('--exclude <ruleIds>', 'Comma-separated rule IDs to skip')
  .option('--critical-only', 'Only fix CRITICAL issues', false)
  .option('--measure', 'Measure BEFORE and AFTER build times')
  .option('--no-verify', 'Skip Gradle verification after applying fixes')
  .action(async (argPath, opts) => {
    await fixCommand({
      projectPath: argPath || opts.path,
      configPath: opts.config,
      dryRun: Boolean(opts.dryRun),
      json: Boolean(opts.json),
      color: Boolean(opts.color),
      only: opts.only,
      exclude: opts.exclude,
      criticalOnly: Boolean(opts.criticalOnly),
      measure: Boolean(opts.measure),
      verify: opts.verify !== false,
    });
  });

program
  .command('config')
  .description('Configure droidperf settings.')
  .option('--set-key <key>', 'Set OpenRouter API key globally')
  .action(async (opts) => {
    await configCommand(opts);
  });

program
  .command('analyze')
  .description('Analyze a Gradle build log to find bottlenecks.')
  .option('--build-log <path>', 'Path to the Gradle build log file')
  .option('--api-key <key>', 'OpenRouter API key (optional if OPENROUTER_API_KEY env var is set)')
  .option('--model <model>', 'LLM model to use (default: openrouter/free)')
  .option('--local', 'Run offline analysis using local expert database instead of LLM', true)
  .option('--apply', 'Automatically apply recommended fixes to project configuration', false)
  .option('--dry-run', 'Preview fixes without writing files (use with --apply)', false)
  .option('--telemetry-off', 'Opt-out of telemetry by forcing local analysis', false)
  .option('--no-color', 'Disable colored output')
  .option('--no-verify', 'Skip Gradle verification after applying fixes')
  .action(async (opts) => {
    await analyzeCommand({
      buildLog: opts.buildLog,
      apiKey: opts.apiKey || process.env.OPENROUTER_API_KEY,
      model: opts.model,
      local: Boolean(opts.local),
      apply: Boolean(opts.apply),
      dryRun: Boolean(opts.dryRun),
      color: Boolean(opts.color),
      verify: opts.verify !== false,
      telemetryOff: Boolean(opts.telemetryOff),
    });
  });

program
  .command('ui')
  .description('Launch the local droidperf web dashboard.')
  .option('--port <number>', 'Port to run the web server on', '9000')
  .action(async (opts) => {
    const { startServer } = require('../src/server');
    const { exec } = require('child_process');
    const chalk = require('chalk');
    const port = parseInt(opts.port, 10);
    
    console.log(chalk.cyan(`🚀 Starting droidperf UI server on http://localhost:${port}...`));
    await startServer(port);
    console.log(chalk.green(`\n⚡ Dashboard running live at http://localhost:${port}`));
    console.log(chalk.gray('Press Ctrl+C to stop the server.'));
    
    const shouldOpenBrowser = !process.env.CI && !process.env.HEADLESS && (process.platform === 'darwin' || process.platform === 'win32' || Boolean(process.env.DISPLAY));
    if (shouldOpenBrowser) {
      const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCmd} http://localhost:${port}`);
    } else {
      console.log(chalk.gray('Browser launch skipped in headless or CI mode.'));
    }
  });

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

