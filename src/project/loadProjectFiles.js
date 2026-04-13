'use strict';

const path = require('path');
const fs = require('fs/promises');
const { pathExists, readFileIfExists, walkFiles } = require('../utils/fs');

async function safeReadTextFile(filePath, { maxBytes }) {
  try {
    const st = await fs.stat(filePath);
    if (!st.isFile()) return null;
    if (typeof maxBytes === 'number' && st.size > maxBytes) return null;
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function detectGradleRoot(projectPath) {
  const candidates = ['settings.gradle', 'settings.gradle.kts'];
  for (const c of candidates) {
    const p = path.join(projectPath, c);
    if (await pathExists(p)) return p;
  }
  return null;
}

function parseIncludedBuilds(settingsText) {
  // Works for both Groovy and KTS in a best-effort way:
  // includeBuild("path") / includeBuild('path')
  // includeBuild("path") { ... } / includeBuild("path") { }
  const re = /\bincludeBuild\s*\(\s*["']([^"']+)["']\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(settingsText))) out.push(m[1]);
  return out;
}

async function loadProjectFiles(projectPath) {
  const settingsPath = await detectGradleRoot(projectPath);
  if (!settingsPath) {
    const err = new Error(
      `Not a Gradle project root: missing settings.gradle/settings.gradle.kts in ${projectPath}\n` +
        `Tip: pass the repo root that contains settings.gradle* via --path`
    );
    err.code = 'DROIDPERF_NOT_GRADLE_ROOT';
    throw err;
  }

  const gradlePropertiesPath = path.join(projectPath, 'gradle.properties');
  const gradlePropertiesText = await readFileIfExists(gradlePropertiesPath, 'utf8');

  const maxFileBytes = 1024 * 1024 * 2; // 2MB guardrail

  const settingsText = (await safeReadTextFile(settingsPath, { maxBytes: maxFileBytes })) || '';
  const included = parseIncludedBuilds(settingsText)
    .map((p) => path.resolve(projectPath, p))
    .filter((p) => p && p !== projectPath);
  const roots = [projectPath, ...included];

  const gradleBuildFiles = [];
  for (const root of roots) {
    // Only scan included builds that look like Gradle roots as well
    const isRootOk = root === projectPath ? true : Boolean(await detectGradleRoot(root));
    if (!isRootOk) continue;

    const files = await walkFiles(root, {
      shouldIncludeFile: (fullPath, name) =>
        name === 'build.gradle' ||
        name === 'build.gradle.kts' ||
        name === 'settings.gradle' ||
        name === 'settings.gradle.kts' ||
        (fullPath.endsWith(`${path.sep}gradle${path.sep}libs.versions.toml`) && name === 'libs.versions.toml'),
    });
    gradleBuildFiles.push(...files);
  }

  const buildFiles = [];
  for (const filePath of gradleBuildFiles) {
    const text = await safeReadTextFile(filePath, { maxBytes: maxFileBytes });
    if (text == null) continue;
    buildFiles.push({ path: filePath, text });
  }

  return {
    projectPath,
    settings: { path: settingsPath },
    gradleProperties: gradlePropertiesText == null ? null : { path: gradlePropertiesPath, text: gradlePropertiesText },
    buildFiles,
    includedBuildRoots: included,
  };
}

module.exports = { loadProjectFiles };

