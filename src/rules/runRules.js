'use strict';

const { getRules } = require('./rules');

function runRules(project) {
  const rules = getRules(project);
  return rules.map((r) => r.audit());
}

module.exports = { runRules };

