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
  .option('--measure', 'Measure BEFORE and AFTER build times')
  .action(async (argPath, opts) => {
    await fixCommand({
      projectPath: argPath || opts.path,
      configPath: opts.config,
      dryRun: Boolean(opts.dryRun),
      json: Boolean(opts.json),
      color: Boolean(opts.color),
      only: opts.only,
      exclude: opts.exclude,
      measure: Boolean(opts.measure),
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
  .description('Analyze a Gradle build log using LLM to find bottlenecks.')
  .option('--build-log <path>', 'Path to the Gradle build log file')
  .option('--api-key <key>', 'OpenRouter API key (optional if OPENROUTER_API_KEY env var is set)')
  .option('--model <model>', 'LLM model to use (default: openrouter/free)')
  .option('--apply', 'Automatically apply recommended fixes to gradle.properties', false)
  .option('--dry-run', 'Preview fixes without writing files (use with --apply)', false)
  .option('--no-color', 'Disable colored output')
  .action(async (opts) => {
    await analyzeCommand({
      buildLog: opts.buildLog,
      apiKey: opts.apiKey,
      model: opts.model,
      apply: Boolean(opts.apply),
      dryRun: Boolean(opts.dryRun),
      color: Boolean(opts.color),
    });
  });

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

