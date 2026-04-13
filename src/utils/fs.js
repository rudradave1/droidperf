'use strict';

const fs = require('fs/promises');
const path = require('path');

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath, encoding = 'utf8') {
  if (!(await pathExists(filePath))) return null;
  return fs.readFile(filePath, encoding);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}`);
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, filePath);
}

function isProbablyGradleDirName(name) {
  return (
    name === 'node_modules' ||
    name === '.git' ||
    name === '.gradle' ||
    name === 'build' ||
    name === '.idea' ||
    name === '.droidperf-backup'
  );
}

async function walkFiles(rootDir, { shouldIncludeFile, shouldSkipDir } = {}) {
  const results = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        const skip =
          (typeof shouldSkipDir === 'function' && shouldSkipDir(full, ent.name)) ||
          isProbablyGradleDirName(ent.name);
        if (!skip) stack.push(full);
      } else if (ent.isFile()) {
        if (!shouldIncludeFile || shouldIncludeFile(full, ent.name)) results.push(full);
      }
    }
  }

  return results;
}

module.exports = {
  ensureDir,
  pathExists,
  readFileIfExists,
  walkFiles,
  writeFileAtomic,
};

