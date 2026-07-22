'use strict';

const { buildLocalExpertReport } = require('./localExpert');
const { extractFixJson } = require('./fixJson');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_TIMEOUT_MS = 60000;

function buildOpenRouterMessages(buildMetrics, expertKnowledge) {
  const systemPrompt = `You are an Android build performance expert. Analyze the provided build metrics and relevant expert knowledge to identify the top bottlenecks and recommend actionable fixes in gradle.properties or build files.`;

  const userPrompt = `Analyze these build metrics and find the top 3 bottlenecks.

Build Summary: ${buildMetrics.summary.split('\\n').filter(line => !line.includes('dependency resolution')).join('\\n')}
Configuration Time: ${buildMetrics.configTime || 'Unknown'}
Total Time: ${buildMetrics.totalTime || 'Unknown'}

Slowest Tasks:
${buildMetrics.slowTasks.map((t) => `- ${t.path}: ${t.duration}s`).join('\\n')}

Detected Warnings:
${buildMetrics.warnings.map((w) => `- ${w}`).join('\\n') || 'None'}

${buildMetrics.failureDetails ? `Build Failure Details:\\n${buildMetrics.failureDetails}\\n` : ''}
Provide an exact fix for each bottleneck with a code snippet and estimated time saved.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

async function analyzeWithOpenRouter({ buildMetrics, expertKnowledge, apiKey, model = 'openrouter/free' }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: buildOpenRouterMessages(buildMetrics, expertKnowledge),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeBuildLog({ buildMetrics, expertKnowledge, apiKey, model = 'openrouter/free', localOnly = false }) {
  if (localOnly || !apiKey) {
    return buildLocalExpertReport(buildMetrics, expertKnowledge);
  }

  try {
    const report = await analyzeWithOpenRouter({ buildMetrics, expertKnowledge, apiKey, model });
    return report;
  } catch (err) {
    console.error('[AnalysisService] AI analysis failed, falling back to local expert:', err.message);
    return buildLocalExpertReport(buildMetrics, expertKnowledge);
  }
}

module.exports = { analyzeBuildLog };
