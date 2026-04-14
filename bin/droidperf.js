#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { auditCommand } = require('../src/commands/audit');
const { fixCommand } = require('../src/commands/fix');
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

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

