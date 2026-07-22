'use strict';

const path = require('path');
const { parseGradleProperties, getProp } = require('../utils/gradleProperties');

function toBool(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return null;
}

function parseXmxMbFromJvmargs(jvmargs) {
  if (!jvmargs) return null;
  const m = String(jvmargs).match(/-Xmx(\d+)([kKmMgG])/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === 'g') return n * 1024;
  if (unit === 'm') return n;
  if (unit === 'k') return Math.round(n / 1024);
  return null;
}

function isDynamicVersion(version) {
  if (!version) return false;
  const v = String(version).trim();
  if (!v) return false;
  if (v.includes('+')) return true;
  if (/\blatest\.(release|integration)\b/i.test(v)) return true;
  // Gradle version ranges, e.g. [1.0,2.0), (1.0,2.0]
  if (/^[[(].+,.+[)\]]$/.test(v)) return true;
  return false;
}

function parseVersionCatalogDynamicInfo(tomlText) {
  // Best-effort parsing for gradle/libs.versions.toml (not a full TOML parser).
  // We only need to detect whether any versions are dynamic.
  const lines = tomlText.split(/\r?\n/);
  let section = null;
  const versions = new Map();

  const sectionRe = /^\s*\[([^\]]+)\]\s*$/;
  const kvQuotedRe = /^\s*([A-Za-z0-9_.-]+)\s*=\s*"([^"]+)"\s*$/;

  for (const line of lines) {
    const noComment = line.replace(/\s+#.*$/, '').trim();
    if (!noComment) continue;
    const sec = noComment.match(sectionRe);
    if (sec) {
      section = sec[1].trim();
      continue;
    }
    if (section === 'versions') {
      const kv = noComment.match(kvQuotedRe);
      if (kv) versions.set(kv[1], kv[2]);
    }
  }

  let hasDynamic = false;

  // direct versions in [versions]
  for (const v of versions.values()) {
    if (isDynamicVersion(v)) {
      hasDynamic = true;
      break;
    }
  }

  if (hasDynamic) return { hasDynamic: true };

  // scan for inline version="..." or inline dependency strings "...:...:version"
  const inlineVersionRe = /\bversion\s*=\s*"([^"]+)"/g;
  const versionRefRe = /\bversion\.ref\s*=\s*"([^"]+)"/g;
  const gavRe = /"([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([^"]+)"/g;

  let m;
  while ((m = inlineVersionRe.exec(tomlText))) {
    if (isDynamicVersion(m[1])) return { hasDynamic: true };
  }
  while ((m = gavRe.exec(tomlText))) {
    if (isDynamicVersion(m[3])) return { hasDynamic: true };
  }
  while ((m = versionRefRe.exec(tomlText))) {
    const ref = m[1];
    const refV = versions.get(ref);
    if (refV && isDynamicVersion(refV)) return { hasDynamic: true };
  }

  return { hasDynamic: false };
}

function countDynamicDependencies(buildFiles) {
  // Heuristic: flag any dependency strings using '+' or latest.* in version position.
  // Groovy: implementation "g:a:1.+", implementation 'g:a:+'
  // Kotlin DSL: implementation("g:a:1.+")
  const dynamicPattern =
    /["']([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([^"']+)["']/g;

  let modules = new Set();
  let foundInVersionCatalog = false;
  for (const f of buildFiles) {
    if (/build\.gradle(\.kts)?$/.test(f.path)) {
      const text = f.text;
      let match;
      while ((match = dynamicPattern.exec(text))) {
        const version = match[3];
        if (isDynamicVersion(version)) {
          modules.add(f.path);
          break;
        }
      }
      continue;
    }

    if (f.path.endsWith(`${path.sep}gradle${path.sep}libs.versions.toml`)) {
      const info = parseVersionCatalogDynamicInfo(f.text);
      if (info.hasDynamic) foundInVersionCatalog = true;
    }
  }
  return {
    modulesCount: modules.size,
    modulePaths: Array.from(modules),
    versionCatalogDynamic: foundInVersionCatalog,
  };
}

function makeResult({ id, title, severity, estimatedSeconds, status, details, fix }) {
  return { id, title, severity, estimatedSeconds, status, details, fix: fix || null };
}

function getRules(project, options = {}) {
  const parsed = project.gradleProperties ? parseGradleProperties(project.gradleProperties.text) : null;
  const prop = (k) => (parsed ? getProp(parsed, k) : null);

  const dynamicDeps = countDynamicDependencies(project.buildFiles);
  const jvmargs = prop('org.gradle.jvmargs');
  const xmxMb = parseXmxMbFromJvmargs(jvmargs);
  const recommendXmxMb = options.recommend?.jvmXmxMb ?? 4096;

  // Analysis for advanced rules
  let hasKaptInBuildFile = false;
  let hasUnoptimizedDebug = false;
  
  for (const f of project.buildFiles) {
    if (!f.text) continue;
    // Check for KAPT
    const kaptRegex = /(kotlin-kapt|org\.jetbrains\.kotlin\.kapt)/;
    if (kaptRegex.test(f.text)) {
      hasKaptInBuildFile = true;
    }
    // Check for unoptimized debug (e.g. debug block exists but missing crunchPngs = false)
    if (f.text.includes('debug {')) {
      const debugBlockMatch = f.text.match(/debug\s*{([^}]*)}/);
      if (debugBlockMatch) {
        const block = debugBlockMatch[1];
        if (block.includes('minifyEnabled true') || block.includes('isMinifyEnabled = true')) {
          hasUnoptimizedDebug = true; // Minifying debug builds kills performance
        }
      }
    }
  }

  const moduleCount = project.buildFiles.filter(f => f.path.endsWith('build.gradle') || f.path.endsWith('build.gradle.kts')).length;

  return [
    {
      id: 'configuration-cache',
      severity: 'CRITICAL',
      estimatedSeconds: 45,
      title: 'Configuration cache disabled',
      audit() {
        const enabled = toBool(prop('org.gradle.configuration-cache'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set org.gradle.configuration-cache=true',
          fix: enabled === true ? null : { type: 'gradle.properties', set: { 'org.gradle.configuration-cache': 'true' } },
        });
      },
    },
    {
      id: 'build-cache',
      severity: 'CRITICAL',
      estimatedSeconds: 32,
      title: 'Build cache disabled',
      audit() {
        const enabled = toBool(prop('org.gradle.caching'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set org.gradle.caching=true',
          fix: enabled === true ? null : { type: 'gradle.properties', set: { 'org.gradle.caching': 'true' } },
        });
      },
    },
    {
      id: 'parallel',
      severity: 'HIGH',
      estimatedSeconds: 38,
      title: 'Parallel execution disabled',
      audit() {
        const enabled = toBool(prop('org.gradle.parallel'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set org.gradle.parallel=true',
          fix: enabled === true ? null : { type: 'gradle.properties', set: { 'org.gradle.parallel': 'true' } },
        });
      },
    },
    {
      id: 'kotlin-incremental',
      severity: 'HIGH',
      estimatedSeconds: 28,
      title: 'Kotlin incremental disabled',
      audit() {
        const enabled = toBool(prop('kotlin.incremental'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set kotlin.incremental=true',
          fix: enabled === true ? null : { type: 'gradle.properties', set: { 'kotlin.incremental': 'true' } },
        });
      },
    },
    {
      id: 'kotlin-classpath-snapshot',
      severity: 'HIGH',
      estimatedSeconds: 24,
      title: 'Kotlin classpath snapshot incremental disabled',
      audit() {
        const enabled = toBool(prop('kotlin.incremental.useClasspathSnapshot'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set kotlin.incremental.useClasspathSnapshot=true',
          fix:
            enabled === true
              ? null
              : { type: 'gradle.properties', set: { 'kotlin.incremental.useClasspathSnapshot': 'true' } },
        });
      },
    },
    {
      id: 'jvm-heap',
      severity: 'MEDIUM',
      estimatedSeconds: 20,
      title: 'JVM heap too low',
      audit() {
        const recommendMb = recommendXmxMb;
        const current = xmxMb;
        const ok = current != null && current >= recommendMb;
        const currentStr = current == null ? 'unknown' : `${current}mb`;
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: ok ? 'pass' : 'fail',
          details: ok ? null : `Current max heap ${currentStr} — recommend ${recommendMb}mb`,
          fix:
            ok
              ? null
              : {
                  type: 'gradle.properties',
                  patch: { 'org.gradle.jvmargs': { kind: 'jvmargs', xmxMb: recommendMb, ensureFileEncodingUtf8: true } },
                },
        });
      },
    },
    {
      id: 'configure-on-demand',
      severity: 'MEDIUM',
      estimatedSeconds: 12,
      title: 'Configure on demand disabled',
      audit() {
        const enabled = toBool(prop('org.gradle.configureondemand'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set org.gradle.configureondemand=true',
          fix:
            enabled === true ? null : { type: 'gradle.properties', set: { 'org.gradle.configureondemand': 'true' } },
        });
      },
    },
    {
      id: 'gradle-daemon',
      severity: 'LOW',
      estimatedSeconds: 8,
      title: 'Gradle daemon disabled',
      audit() {
        const enabled = toBool(prop('org.gradle.daemon'));
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: enabled === true ? 'pass' : 'fail',
          details: enabled === true ? null : 'Set org.gradle.daemon=true',
          fix: enabled === true ? null : { type: 'gradle.properties', set: { 'org.gradle.daemon': 'true' } },
        });
      },
    },
    {
      id: 'dynamic-deps',
      severity: 'LOW',
      estimatedSeconds: 15,
      title: 'Dynamic dependency versions',
      audit() {
        const ok = dynamicDeps.modulesCount === 0 && dynamicDeps.versionCatalogDynamic === false;
        const parts = [];
        if (dynamicDeps.modulesCount) parts.push(`${dynamicDeps.modulesCount} module(s)`);
        if (dynamicDeps.versionCatalogDynamic) parts.push('version catalog');
        return makeResult({
          id: this.id,
          title: this.title,
          severity: ok ? 'LOW' : 'LOW',
          estimatedSeconds: 15,
          status: ok ? 'pass' : 'fail',
          details: ok ? null : `Found in ${parts.join(' and ')}`,
          fix: null, // not safe to auto-fix
        });
      },
    },
    {
      id: 'kapt-usage',
      severity: 'HIGH',
      estimatedSeconds: 40,
      title: 'KAPT is used instead of KSP',
      audit() {
        const ok = !hasKaptInBuildFile;
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: ok ? 'pass' : 'fail',
          details: ok ? null : 'Migrate from kotlin-kapt to KSP to speed up build significantly',
          fix: null, 
        });
      },
    },
    {
      id: 'unnecessary-modules',
      severity: 'INFO',
      estimatedSeconds: 0,
      title: 'Large module count',
      audit() {
        // Just an informational warning if project has an excessive number of modules which can bloat configuration
        const ok = moduleCount < 50;
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: ok ? 'pass' : 'fail',
          details: ok ? null : `${moduleCount} modules detected. Consider consolidating if they share tight coupling and don't benefit from parallelization.`,
          fix: null,
        });
      },
    },
    {
      id: 'debug-build-unoptimized',
      severity: 'MEDIUM',
      estimatedSeconds: 25,
      title: 'Debug build incorrectly optimized',
      audit() {
        const ok = !hasUnoptimizedDebug;
        return makeResult({
          id: this.id,
          title: this.title,
          severity: this.severity,
          estimatedSeconds: this.estimatedSeconds,
          status: ok ? 'pass' : 'fail',
          details: ok ? null : 'Debug build was found to have minifyEnabled set to true, which slows down iteration.',
          fix: null,
        });
      },
    },
  ];
}

module.exports = { getRules };
