'use strict';

const path = require('path');
const chalk = require('chalk');
const { loadProjectFiles } = require('../project/loadProjectFiles');
const { runRules } = require('../rules/runRules');
const { applyFixes } = require('../rules/applyFixes');
const { formatFixReport } = require('../ui/formatFixReport');

async function fixCommand({ projectPath, dryRun, json, color }) {
  const absProjectPath = path.resolve(projectPath);
  const project = await loadProjectFiles(absProjectPath);
  const results = runRules(project);

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
          projectPath: absProjectPath,
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

