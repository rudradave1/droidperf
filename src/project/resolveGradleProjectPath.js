'use strict';

const path = require('path');
const { loadProjectFiles } = require('./loadProjectFiles');

async function resolveGradleProjectPath(inputPath) {
  const abs = path.resolve(inputPath);
  try {
    const project = await loadProjectFiles(abs);
    return { resolvedPath: abs, project };
  } catch (e) {
    if (e && e.code === 'DROIDPERF_NOT_GRADLE_ROOT') {
      const flutterAndroid = path.join(abs, 'android');
      const project = await loadProjectFiles(flutterAndroid);
      return { resolvedPath: flutterAndroid, project, inferred: { kind: 'flutter', originalPath: abs } };
    }
    throw e;
  }
}

module.exports = { resolveGradleProjectPath };

