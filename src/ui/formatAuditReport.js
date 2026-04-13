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
  const savingsMin = totalSavingsSec / 60;

  const lines = [];
  lines.push('Scanning your Android project...');
  lines.push('');
  lines.push(
    failing.length
      ? `Found ${failing.length} issues costing you ~${savingsMin.toFixed(1)} minutes per build:`
      : 'No issues found. Your project looks well-tuned.'
  );
  lines.push('');

  for (const r of failing) {
    const color = severityColor(chalk, r.severity);
    const sev = color(`[${padSeverity(r.severity).trim()}]`);
    const dash = '—';
    let tail = '';
    if (r.id === 'jvm-heap') {
      tail = r.details ? ` ${dash} ${r.details.replace(/^Current /, '').replace(' — ', ' — ')}` : '';
      // sample wants: "JVM heap too low (512mb) — recommend 4096mb"
      // best-effort: just use details string
      tail = r.details ? ` ${dash} ${r.details.replace(/^Current max heap /, '').replace(' — ', ' — ')}` : '';
      lines.push(`${sev} ${r.title}${tail}`);
      continue;
    }
    if (r.id === 'dynamic-deps') {
      const detail = r.details ? ` found in ${r.details.replace(/^Found in /, '').replace(' module(s)', ' modules')}` : '';
      lines.push(`${sev} ${r.title} — +${formatSecondsExact(r.estimatedSeconds)} per build${detail ? ` (${detail.trim()})` : ''}`);
      continue;
    }

    lines.push(`${sev} ${r.title} — +${formatSecondsExact(r.estimatedSeconds)} per build`);
  }

  if (failing.length) {
    lines.push('');
    const bpd = Number.isFinite(buildsPerDay) ? buildsPerDay : 20;
    const wasteMinutesPerDay = (totalSavingsSec / 60) * bpd;
    lines.push(`Estimated waste: ${savingsMin.toFixed(1)} min/build × ${bpd} builds/day = ${wasteMinutesPerDay.toFixed(0)} min/day`);
    lines.push('');
    lines.push(`Run 'droidperf fix' to apply all fixes automatically.`);
  }

  return lines.join('\n');
}

module.exports = { formatAuditReport };

