'use strict';

const path = require('path');
const { loadProjectFiles } = require('./loadProjectFiles');
const { pathExists } = require('../utils/fs');

async function detectGradleRoot(projectPath) {
  const candidates = ['settings.gradle', 'settings.gradle.kts'];
  for (const c of candidates) {
    const p = path.join(projectPath, c);
    if (await pathExists(p)) return p;
  }
  return null;
}

async function findNearestGradleRoot(startPath) {
  let current = path.resolve(startPath);
  // If a file path is provided, treat its directory as the start.
  if (path.extname(current)) current = path.dirname(current);

  while (true) {
    if (await detectGradleRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function resolveGradleProjectPath(inputPath) {
  const abs = path.resolve(inputPath);
  try {
    const project = await loadProjectFiles(abs);
    return { resolvedPath: abs, project };
  } catch (e) {
    if (e && e.code === 'DROIDPERF_NOT_GRADLE_ROOT') {
      // Common: user passes a module path (e.g. KMP `androidApp/`). Walk up to repo root.
      const nearest = await findNearestGradleRoot(abs);
      if (nearest && nearest !== abs) {
        const project = await loadProjectFiles(nearest);
        return { resolvedPath: nearest, project, inferred: { kind: 'nearest-gradle-root', originalPath: abs } };
      }

      // Common: user passes a Flutter project root; Android Gradle root lives at `<flutter>/android`.
      const flutterAndroid = path.join(abs, 'android');
      if (await detectGradleRoot(flutterAndroid)) {
        const project = await loadProjectFiles(flutterAndroid);
        return { resolvedPath: flutterAndroid, project, inferred: { kind: 'flutter', originalPath: abs } };
      }
    }
    throw e;
  }
}

module.exports = { resolveGradleProjectPath };

