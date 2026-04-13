'use strict';

const path = require('path');
const fs = require('fs/promises');
const { pathExists } = require('../utils/fs');

const DEFAULT_CONFIG = {
  buildsPerDay: 20,
  recommend: {
    jvmXmxMb: 4096,
  },
  rules: {
    enabled: {},
  },
};

async function readJsonIfExists(p) {
  if (!(await pathExists(p))) return null;
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt);
}

function deepMerge(base, override) {
  if (override == null) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override;
  if (typeof base !== 'object' || typeof override !== 'object') return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

async function loadDroidperfConfig(projectPath, explicitConfigPath) {
  const candidates = explicitConfigPath
    ? [path.resolve(explicitConfigPath)]
    : [
        path.join(projectPath, '.droidperfrc.json'),
        path.join(projectPath, 'droidperf.config.json'),
      ];

  for (const c of candidates) {
    try {
      const j = await readJsonIfExists(c);
      if (j) return { path: c, config: deepMerge(DEFAULT_CONFIG, j) };
    } catch {
      // ignore parse errors here; surface as no config
    }
  }

  return { path: null, config: { ...DEFAULT_CONFIG } };
}

module.exports = { loadDroidperfConfig, DEFAULT_CONFIG };

