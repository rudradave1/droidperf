'use strict';

const { getRules } = require('./rules');

function runRules(project, { config } = {}) {
  const rules = getRules(project, config || {});
  const enabledMap = config?.rules?.enabled || {};
  const results = [];
  for (const r of rules) {
    if (enabledMap[r.id] === false) continue;
    results.push(r.audit());
  }
  return results;
}

module.exports = { runRules };

