'use strict';

const path = require('path');
const chalk = require('chalk');
const { runRules } = require('../rules/runRules');
const { formatAuditReport } = require('../ui/formatAuditReport');
const { listRules } = require('../rules/listRules');
const { loadDroidperfConfig } = require('../config/loadConfig');
const { resolveGradleProjectPath } = require('../project/resolveGradleProjectPath');

async function auditCommand({ projectPath, json, color, listRules: shouldListRules, configPath }) {
  if (shouldListRules) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ rules: listRules() }, null, 2));
    process.exitCode = 0;
    return;
  }

  const absProjectPath = path.resolve(projectPath);
  const resolved = await resolveGradleProjectPath(absProjectPath);
  const cfg = await loadDroidperfConfig(resolved.resolvedPath, configPath);
  const project = resolved.project;
  const results = runRules(project, { config: cfg.config });

  if (json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          projectPath: resolved.resolvedPath,
          inferred: resolved.inferred || null,
          configPath: cfg.path,
          results,
        },
        null,
        2
      )
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      formatAuditReport({
        projectPath: resolved.resolvedPath,
        results,
        chalk: color ? chalk : null,
        buildsPerDay: cfg.config.buildsPerDay,
      })
    );
  }

  const hasCritical = results.some((r) => r.status === 'fail' && r.severity === 'CRITICAL');
  process.exitCode = hasCritical ? 2 : 0;
}

module.exports = { auditCommand };

