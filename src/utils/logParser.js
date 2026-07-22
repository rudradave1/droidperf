'use strict';

/**
 * Extracts key performance metrics from a Gradle build log.
 */
function parseGradleLog(logContent) {
  const tasks = [];
  const lines = logContent.split(/\r?\n/);

  // Noise/trivial tasks patterns to ignore
  const NOISE_TASKS_PATTERNS = [
    /preBuild$/i,
    /preDebugBuild$/i,
    /preReleaseBuild$/i,
    /mockableAndroidJar$/i,
    /generate.*BuildConfig$/i,
    /javaPreCompile.*/i,
    /compile.*Sources$/i,
    /check.*Manifest$/i,
    /check.*AarMetadata$/i,
    /extractDeepLinks.*/i,
    /process.*Manifest$/i,
    /.*\.incremental$/i,
    /validateSigning.*/i,
    /check.*DuplicateClasses$/i,
    /create.*CompatibleScreenManifests$/i
  ];

  // Regex and handler suite for task execution timings
  const taskPatterns = [
    // > Task :module:taskName SUCCESS [1m 12.5s] or [500ms]
    {
      re: /> Task (:[^ ]+)(?:\s+\w+)?(?:\s+\[(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:([\d\.]+)s)?(?:(\d+)ms)?\])/,
      handler(match) {
        const path = match[1];
        const h = match[2] ? parseFloat(match[2]) : 0;
        const m = match[3] ? parseFloat(match[3]) : 0;
        const s = match[4] ? parseFloat(match[4]) : 0;
        const ms = match[5] ? parseFloat(match[5]) : 0;
        const duration = h * 3600 + m * 60 + s + ms / 1000;
        return { path, duration };
      }
    },
    // > Task :module:taskName (without time)
    {
      re: /> Task (:[^ ]+)(?:\s+\w+)?/,
      handler(match) {
        return { path: match[1], duration: null };
      }
    },
    // :module:taskName took 12.5s or took 1m 12s
    {
      re: /(?:^|\s)(:[^ ]+)\s+took\s+(?:(\d+)m\s*)?([\d\.]+)s/,
      handler(match) {
        const path = match[1];
        const m = match[2] ? parseFloat(match[2]) : 0;
        const s = parseFloat(match[3]);
        return { path, duration: m * 60 + s };
      }
    },
    // :module:taskName (Thread[...]) ... Took 12.5 secs
    {
      re: /(?:^|\s)(:[^ ]+)\s+.*[tT]ook\s+([\d\.]+)\s+secs/,
      handler(match) {
        return { path: match[1], duration: parseFloat(match[2]) };
      }
    },
    // :module:taskName - 12.5s
    {
      re: /(?:^|\s)(:[^ ]+)\s+-\s+([\d\.]+)s/,
      handler(match) {
        return { path: match[1], duration: parseFloat(match[2]) };
      }
    }
  ];

  // Configuration time regex suite
  const configRegexes = [
    /Configuring projects:\s*(?:(\d+)m\s*)?([\d\.]+)s/,
    /Configure projects:\s*(?:(\d+)m\s*)?([\d\.]+)s/,
    /Configuration took\s*(?:(\d+)m\s*)?([\d\.]+)s/,
    /Settings evaluated in\s*(?:(\d+)m\s*)?([\d\.]+)s/,
    /Projects configured in\s*(?:(\d+)m\s*)?([\d\.]+)s/i
  ];

  // Total time and build outcome regex suite
  const totalTimeRegexes = [
    /(BUILD SUCCESSFUL|BUILD FAILED|Build finished|Task execution finished) in\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?(?:(\d+)ms)?/i
  ];

  let configTime = null;
  let summedConfigTime = 0;
  let hasParsedConfigTime = false;
  let totalTime = null;
  let buildStatus = 'UNKNOWN';
  const warnings = new Set();
  const failureLines = [];
  let inWhatWentWrong = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check task executions
    let taskFound = false;
    for (const pattern of taskPatterns) {
      const match = line.match(pattern.re);
      if (match) {
        const res = pattern.handler(match);
        // Avoid adding duplicates of the same task path
        if (res && res.path) {
          const isNoise = NOISE_TASKS_PATTERNS.some(p => p.test(res.path));
          if (!isNoise) {
            tasks.push({
              path: res.path,
              duration: res.duration,
              raw: trimmed
            });
          }
          taskFound = true;
          break;
        }
      }
    }

    // Extract configuration time
    const configModuleRegex = /Configure project\s+(:[^\s>]*)\s*>\s*(?:(\d+)m\s*)?([\d\.]+)s/;
    const mConfig = line.match(configModuleRegex);
    if (mConfig) {
      const mins = mConfig[2] ? parseInt(mConfig[2]) : 0;
      const secs = parseFloat(mConfig[3]);
      summedConfigTime += mins * 60 + secs;
      hasParsedConfigTime = true;
    }

    if (!configTime) {
      for (const rx of configRegexes) {
        const m = line.match(rx);
        if (m) {
          const mins = m[1] ? parseInt(m[1]) : 0;
          const secs = parseFloat(m[2]);
          configTime = `${mins * 60 + secs}s`;
          break;
        }
      }
    }

    // Extract total time and status
    for (const rx of totalTimeRegexes) {
      const m = line.match(rx);
      if (m) {
        buildStatus = m[1].toUpperCase().includes('FAIL') ? 'FAILED' : 'SUCCESS';
        const h = m[2] ? parseInt(m[2]) : 0;
        const mins = m[3] ? parseInt(m[3]) : 0;
        const secs = m[4] ? parseFloat(m[4]) : 0;
        const ms = m[5] ? parseFloat(m[5]) : 0;
        totalTime = `${h * 3600 + mins * 60 + secs + ms / 1000}s`;
        break;
      }
    }

    // Capture failure details (What went wrong block)
    if (trimmed.startsWith('* What went wrong:')) {
      inWhatWentWrong = true;
      failureLines.push(trimmed);
      continue;
    }
    if (inWhatWentWrong) {
      if (trimmed.startsWith('* ') && !trimmed.startsWith('* What went wrong:')) {
        inWhatWentWrong = false;
      } else {
        failureLines.push(trimmed);
      }
    }

    // Warnings/Issues patterns
    if (line.includes('Expiring Daemon because JVM heap space is exhausted')) {
      warnings.add('JVM heap exhausted');
    }
    if (line.includes('GC overhead limit exceeded')) {
      warnings.add('GC overhead limit exceeded');
    }
    if (line.includes('kapt') && (line.includes('slow') || line.includes('bottleneck') || line.includes('warning'))) {
      warnings.add('Kapt bottleneck detected');
    }
    if (line.includes('android.enableJetifier=true')) {
      warnings.add('Jetifier is enabled');
    }
    if (line.includes('Configuration cache cannot be reused')) {
      warnings.add('Configuration cache invalidated');
    }
    if (line.includes('is deprecated') || line.includes('has been deprecated')) {
      warnings.add('Deprecation warnings detected');
    }
  }

  // Deduplicate and aggregate task list
  const taskMap = new Map();
  for (const t of tasks) {
    if (t.duration !== null) {
      // If we see the same task multiple times (e.g. composite builds / runs), keep the longest duration
      const existing = taskMap.get(t.path);
      if (!existing || existing.duration < t.duration) {
        taskMap.set(t.path, t);
      }
    }
  }

  if (!configTime && hasParsedConfigTime) {
    configTime = `${summedConfigTime.toFixed(1)}s`;
  }

  const slowTasks = Array.from(taskMap.values())
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 7); // Focus strictly on Top 7 Sinks to conserve token window

  const warningsArray = Array.from(warnings);
  const failureDetails = failureLines.join('\n').trim();

  return {
    slowTasks,
    configTime,
    totalTime,
    buildStatus,
    warnings: warningsArray,
    failureDetails: failureDetails || null,
    summary: `Build ${buildStatus} in ${totalTime || 'unknown time'}. Config time: ${configTime || 'unknown'}. Found ${taskMap.size} non-noise tasks.`
  };
}

module.exports = { parseGradleLog };
