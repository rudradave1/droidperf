'use strict';

function severityRank(sev) {
  if (sev === 'CRITICAL') return 0;
  if (sev === 'HIGH') return 1;
  if (sev === 'MEDIUM') return 2;
  return 3;
}

function formatFixReport({ projectPath, results, applied, dryRun, chalk }) {
  const failing = results.filter((r) => r.status === 'fail');
  const fixedRuleIds = new Set(applied.applied.map((a) => a.ruleId));

  const backups = applied.backups || [];
  const diffs = applied.diffs || [];

  const lines = [];
  lines.push(dryRun ? 'Previewing fixes (dry-run)...' : 'Applying fixes...');
  lines.push('');

  if (failing.length === 0) {
    lines.push('No issues to fix.');
    return lines.join('\n');
  }

  const ordered = [...failing].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  for (const r of ordered) {
    const isFixed = fixedRuleIds.has(r.id);
    const status = isFixed ? 'FIXED' : r.fix ? 'SKIPPED' : 'MANUAL';
    const label = chalk
      ? status === 'FIXED'
        ? chalk.greenBright(`[${status}]`)
        : status === 'SKIPPED'
          ? chalk.yellowBright(`[${status}]`)
          : chalk.cyanBright(`[${status}]`)
      : `[${status}]`;
    lines.push(`${label} ${r.title}`);
  }

  if (backups.length) {
    lines.push('');
    lines.push('Backups:');
    for (const b of backups) {
      lines.push(`- ${b.backupPath}`);
    }
  }

  if (applied.before && applied.after && applied.before.gradleProperties !== applied.after.gradleProperties) {
    lines.push('');
    lines.push('Changed: gradle.properties');
    if (dryRun) {
      lines.push('(dry-run: no files written)');
    }
  }

  if (dryRun && diffs.length) {
    lines.push('');
    lines.push('Diff:');
    for (const d of diffs) {
      lines.push(d.trimEnd());
      lines.push('');
    }
  }

  return lines.join('\n');
}

module.exports = { formatFixReport };

