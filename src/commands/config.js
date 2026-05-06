'use strict';

const chalk = require('chalk');
const { setGlobalApiKey } = require('../config/globalConfig');

async function configCommand(opts) {
  const { setKey } = opts;

  if (setKey) {
    await setGlobalApiKey(setKey);
    console.log(chalk.green('✅ OpenRouter API key saved successfully.'));
    return;
  }

  console.log('Usage: droidperf config --set-key <key>');
}

module.exports = { configCommand };
