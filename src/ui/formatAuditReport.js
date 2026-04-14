'use strict';

function formatSeconds(sec) {
  if (sec < 60) return `~${Math.round(sec)}s`;
  const min = sec / 60;
  return `~${min.toFixed(1)} min`;
}

function formatSecondsExact(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m}m ${s}s`;
}

function severityColor(chalk, severity) {
  if (!chalk) return (s) => s;
  if (severity === 'CRITICAL') return chalk.redBright;
  if (severity === 'HIGH') return chalk.yellowBright;
  if (severity === 'MEDIUM') return chalk.cyanBright;
  return chalk.gray;
}

function padSeverity(sev) {
  const w = 9;
  return (sev + ' '.repeat(w)).slice(0, w);
}

function formatAuditReport({ projectPath, results, chalk, buildsPerDay }) {
  const failing = results.filter((r) => r.status === 'fail');
  const totalSavingsSec = failing.reduce((sum, r) => sum + (r.estimatedSeconds || 0), 0);
  
  const bpd = Number.isFinite(buildsPerDay) ? buildsPerDay : 20;
  const wasteMinutesPerDay = (totalSavingsSec / 60) * bpd;

  const lines = [];
  
  const header = chalk ? chalk.bold('Project Health Report') : 'Project Health Report';
  lines.push(header);
  lines.push('');
  lines.push(`Issues found: ${failing.length}`);
  if (failing.length > 0) {
    lines.push(`Estimated time wasted/day: ${Math.round(wasteMinutesPerDay)} min`);
  }
  lines.push('');

  if (failing.length === 0) {
    lines.push('No issues found. Your project looks well-tuned.');
  } else {
    lines.push('Top issues:');
    const ordered = [...failing].sort((a, b) => (b.estimatedSeconds || 0) - (a.estimatedSeconds || 0));
    
    // Show top 3 or 4 issues
    const top = ordered.slice(0, 4);
    for (const r of top) {
      lines.push(`- ${r.title}`);
    }
    
    if (ordered.length > top.length) {
      lines.push(`- ... and ${ordered.length - top.length} more`);
    }

    lines.push('');
    
    const hasCritical = failing.some(r => r.severity === 'CRITICAL');
    const hasHigh = failing.some(r => r.severity === 'HIGH');
    
    let priority = 'LOW';
    if (hasCritical) priority = 'CRITICAL';
    else if (hasHigh) priority = 'HIGH';
    else if (failing.some(r => r.severity === 'MEDIUM')) priority = 'MEDIUM';

    const prioText = chalk ? severityColor(chalk, priority)(priority) : priority;
    lines.push(`Recommendation: ${prioText} priority fix`);
    lines.push(`Run 'droidperf fix' to apply all fixes automatically.`);
  }

  return lines.join('\n');
}

module.exports = { formatAuditReport };

