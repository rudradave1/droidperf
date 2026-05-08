'use strict';

/**
 * Extracts key performance metrics from a Gradle build log.
 */
function parseGradleLog(logContent) {
  const tasks = [];
  const lines = logContent.split(/\r?\n/);

  // Regex for tasks like: "> Task :app:compileKotlin [12.5s]" or "> Task :app:assembleDebug"
  // Note: Duration is usually only shown with --info or certain Gradle versions/plugins
  const taskRegex = /> Task (:[^ ]+)(?: \[([\d\.]+)s\])?/;

  // Regex for configuration time: "Configuring projects: 5.2s"
  const configRegex = /Configuring projects: ([\d\.]+)s/;

  // Regex for total build time: "BUILD SUCCESSFUL in 1m 24s"
  const totalTimeRegex = /BUILD SUCCESSFUL in (?:(\d+)m )?(\d+)s/;

  let configTime = null;
  let totalTime = null;
  const warnings = [];

  for (const line of lines) {
    // Extract tasks
    const taskMatch = line.match(taskRegex);
    if (taskMatch) {
      tasks.push({
        path: taskMatch[1],
        duration: taskMatch[2] ? parseFloat(taskMatch[2]) : null,
        raw: line
      });
    }

    // Extract configuration time
    const configMatch = line.match(configRegex);
    if (configMatch) configTime = configMatch[1] + 's';

    // Extract total time
    const totalMatch = line.match(totalTimeRegex);
    if (totalMatch) {
      const mins = totalMatch[1] ? parseInt(totalMatch[1]) : 0;
      const secs = parseInt(totalMatch[2]);
      totalTime = `${mins * 60 + secs}s`;
    }

    // Detect common warning patterns
    if (line.includes('Expiring Daemon because JVM heap space is exhausted')) {
      warnings.push('JVM heap exhausted');
    }
    if (line.includes('kapt') && line.includes('slow')) {
      warnings.push('Kapt bottleneck detected');
    }
  }

  // Sort tasks by duration if available, otherwise keep order
  const slowTasks = tasks
    .filter(t => t.duration !== null)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 15);

  return {
    slowTasks,
    configTime,
    totalTime,
    warnings,
    summary: `Build took ${totalTime || 'unknown time'}. Config time: ${configTime || 'unknown'}. Found ${tasks.length} tasks.`
  };
}

module.exports = { parseGradleLog };
