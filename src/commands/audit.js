'use strict';

const path = require('path');
const chalk = require('chalk');
const { loadProjectFiles } = require('../project/loadProjectFiles');
const { runRules } = require('../rules/runRules');
const { formatAuditReport } = require('../ui/formatAuditReport');

async function auditCommand({ projectPath, json, color }) {
  const absProjectPath = path.resolve(projectPath);
  const project = await loadProjectFiles(absProjectPath);
  const results = runRules(project);

  if (json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          projectPath: absProjectPath,
          results,
        },
        null,
        2
      )
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(formatAuditReport({ projectPath: absProjectPath, results, chalk: color ? chalk : null }));
  }

  const hasCritical = results.some((r) => r.status === 'fail' && r.severity === 'CRITICAL');
  process.exitCode = hasCritical ? 2 : 0;
}

module.exports = { auditCommand };

