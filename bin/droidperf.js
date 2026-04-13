#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { auditCommand } = require('../src/commands/audit');
const { fixCommand } = require('../src/commands/fix');

program
  .name('droidperf')
  .description('Android Gradle performance auditor and auto-fixer.')
  .version('0.1.0');

program
  .command('audit')
  .description('Audit an Android project for build performance issues.')
  .option('--path <path>', 'Project path', process.cwd())
  .option('--json', 'Output JSON', false)
  .option('--no-color', 'Disable colored output')
  .action(async (opts) => {
    await auditCommand({ projectPath: opts.path, json: Boolean(opts.json), color: Boolean(opts.color) });
  });

program
  .command('fix')
  .description('Apply safe performance fixes to an Android project.')
  .option('--path <path>', 'Project path', process.cwd())
  .option('--dry-run', 'Preview fixes without writing files', false)
  .option('--json', 'Output JSON', false)
  .option('--no-color', 'Disable colored output')
  .action(async (opts) => {
    await fixCommand({
      projectPath: opts.path,
      dryRun: Boolean(opts.dryRun),
      json: Boolean(opts.json),
      color: Boolean(opts.color),
    });
  });

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

