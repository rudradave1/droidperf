'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { pathExists } = require('../utils/fs');

const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.droidperf', 'config.json');

async function getGlobalApiKey() {
  try {
    if (!(await pathExists(GLOBAL_CONFIG_PATH))) return null;
    const content = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);
    return config.openRouterApiKey || null;
  } catch (err) {
    return null;
  }
}

async function setGlobalApiKey(apiKey) {
  const dir = path.dirname(GLOBAL_CONFIG_PATH);
  if (!(await pathExists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }
  let config = {};
  try {
    if (await pathExists(GLOBAL_CONFIG_PATH)) {
      const content = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
      config = JSON.parse(content);
    }
  } catch (err) {
    // start fresh if corrupt
  }
  config.openRouterApiKey = apiKey;
  await fs.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
  getGlobalApiKey,
  setGlobalApiKey,
};
