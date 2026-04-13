'use strict';

const { getRules } = require('./rules');

function listRules() {
  // Provide a stable list without requiring a project.
  const rules = getRules({ gradleProperties: null, buildFiles: [] });
  return rules.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    estimatedSeconds: r.estimatedSeconds,
    hasAutofix: Boolean(r.audit().fix),
  }));
}

module.exports = { listRules };

