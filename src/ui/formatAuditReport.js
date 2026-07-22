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

const Table = require('cli-table3');

function formatAuditReport({ projectPath, results, chalk, buildsPerDay }) {
  const failing = results.filter((r) => r.status === 'fail');
  const totalSavingsSec = failing.reduce((sum, r) => sum + (r.estimatedSeconds || 0), 0);
  
  const bpd = Number.isFinite(buildsPerDay) ? buildsPerDay : 20;
  const wasteMinutesPerDay = (totalSavingsSec / 60) * bpd;

  const lines = [];
  lines.push(chalk ? chalk.bold('Project Health Report') : 'Project Health Report');
  lines.push('');
  lines.push(`Issues found: ${failing.length}`);
  if (failing.length > 0) {
    lines.push(`Estimated time wasted/day: ${Math.round(wasteMinutesPerDay)} min`);
  }
  lines.push('');

  if (failing.length > 0) {
    const table = new Table({
        head: ['Issue', 'Severity', 'Impact'],
        colWidths: [40, 10, 15]
    });

    const ordered = [...failing].sort((a, b) => (b.estimatedSeconds || 0) - (a.estimatedSeconds || 0));
    for (const r of ordered.slice(0, 5)) {
        table.push([r.title.slice(0, 38), r.severity, formatSeconds(r.estimatedSeconds || 0)]);
    }
    lines.push(table.toString());
    lines.push('');
  } else {
    lines.push('No issues found. Your project looks well-tuned.');
  }

  return lines.join('\n');
}

module.exports = { formatAuditReport };

