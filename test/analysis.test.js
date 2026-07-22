'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFixJson } = require('../src/analysis/fixJson');
const { buildLocalExpertReport } = require('../src/analysis/localExpert');

const sampleBuildMetrics = {
  buildStatus: 'SUCCESS',
  totalTime: '2m 15s',
  configTime: '15s',
  slowTasks: [{ path: ':app:compileDebugKotlin', duration: 34 }],
  warnings: ['Configuration cache invalidated'],
};

test('extractFixJson returns parsed JSON from fenced FIX_JSON block', () => {
  const input = 'Some analysis text\nFIX_JSON\n```json\n{\n  "fixes": [{"type": "gradle.properties", "property": "org.gradle.parallel", "value": "true"}]\n}\n```\n';
  const result = extractFixJson(input);
  assert.deepEqual(result, {
    fixes: [{ type: 'gradle.properties', property: 'org.gradle.parallel', value: 'true' }],
  });
});

test('extractFixJson returns parsed JSON from raw JSON after FIX_JSON', () => {
  const input = 'Result summary\nFIX_JSON {"fixes":[{"type":"gradle.properties","property":"org.gradle.caching","value":"true"}]}\n';
  const result = extractFixJson(input);
  assert.deepEqual(result, {
    fixes: [{ type: 'gradle.properties', property: 'org.gradle.caching', value: 'true' }],
  });
});

test('buildLocalExpertReport returns default recommendations for minimal input', () => {
  const report = buildLocalExpertReport({
    ...sampleBuildMetrics,
    warnings: [],
    slowTasks: [],
  }, []);

  assert.ok(report.reportMarkdown.includes('Local Expert Build Performance Analysis'));
  assert.ok(report.reportMarkdown.includes('org.gradle.parallel')); // default fallback fix
  assert.ok(Array.isArray(report.fixes));
  assert.ok(report.fixes.some((fix) => fix.property === 'org.gradle.parallel'));
});

test('buildLocalExpertReport includes configuration cache recommendation from warnings', () => {
  const report = buildLocalExpertReport(sampleBuildMetrics, ['Configuration cache invalidated']);
  assert.ok(report.fixes.some((fix) => fix.property === 'org.gradle.configuration-cache'));
});
