'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { parseGradleLog } = require('./utils/logParser');
const { getRelevantKnowledge } = require('./knowledge/gradlePatterns');
const { resolveGradleProjectPath } = require('./project/resolveGradleProjectPath');
const { loadDroidperfConfig } = require('./config/loadConfig');
const { runRules } = require('./rules/runRules');
const { applyFixes } = require('./rules/applyFixes');
const { analyzeBuildLog } = require('./analysis/analysisService');
const { getGradleCommand } = require('./utils/fs');
const { spawnSync } = require('child_process');

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // 1. Serve static web content
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const htmlPath = path.join(__dirname, 'web', 'index.html');
      const html = await fs.readFile(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && (pathname === '/how-it-works' || pathname === '/how-it-works.html')) {
      const htmlPath = path.join(__dirname, 'web', 'how-it-works.html');
      const html = await fs.readFile(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // 2. API: Get audit rules (The missing piece)
    if (req.method === 'GET' && pathname === '/api/rules') {
      try {
        const rules = await runRules();
        return sendJSON(res, 200, rules);
      } catch (err) {
        return sendJSON(res, 500, { error: 'Audit failed: ' + err.message });
      }
    }

    // 3. API: Analyze build log
    if (req.method === 'POST' && pathname === '/api/analyze-log') {
      const bodyText = await getBody(req);
      const payload = JSON.parse(bodyText);
      const { logContent, useAI, apiKey } = payload;
      if (!logContent) return sendJSON(res, 400, { error: 'Missing logContent' });

      const buildMetrics = parseGradleLog(logContent);
      let project = null;
      try {
        const resolved = await resolveGradleProjectPath(process.cwd());
        project = resolved.project;
      } catch {}

      const expertKnowledge = getRelevantKnowledge(buildMetrics);
      const rulesResults = await runRules(buildMetrics, project, expertKnowledge);
      
      return sendJSON(res, 200, {
        score: rulesResults.score,
        rules: rulesResults.rules,
        metrics: buildMetrics
      });
    }

    // 4. API: Apply Fixes
    if (req.method === 'POST' && pathname === '/api/fix') {
      const bodyText = await getBody(req);
      const payload = JSON.parse(bodyText);
      const result = await applyFixes(payload.criticalOnly);
      return sendJSON(res, 200, result);
    }

    // 5. API: Project Info
    if (req.method === 'GET' && pathname === '/api/project') {
      const config = await loadDroidperfConfig();
      return sendJSON(res, 200, config);
    }

    // 6. API: Upload log
    if (req.method === 'POST' && pathname === '/api/upload') {
      const logContent = await getBody(req);
      if (!logContent) return sendJSON(res, 400, { error: 'No log content provided' });
      try {
        await fs.writeFile(path.join(process.cwd(), 'build.log'), logContent);
        return sendJSON(res, 200, { message: 'Log uploaded successfully' });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Failed to save log: ' + err.message });
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: err.message });
  }
});

const PORT = 9000;
server.listen(PORT, () => {
  console.log(`droidperf server listening on port ${PORT}`);
});
