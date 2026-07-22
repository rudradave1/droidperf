'use strict';

function buildLocalExpertFixes(buildMetrics, expertKnowledge) {
  const fixes = [];
  const details = [];

  const hasParallelHint = expertKnowledge.some((k) => k.includes('parallel execution') || k.includes('org.gradle.parallel=true'));
  if (hasParallelHint) {
    fixes.push({ type: 'gradle.properties', property: 'org.gradle.parallel', value: 'true' });
    details.push('Parallel Execution: Concurrently compile independent subprojects.');
  }

  const hasJvmHeapHint = expertKnowledge.some((k) => k.includes('JVM max heap') || k.includes('heap space') || k.includes('GC overhead'));
  if (hasJvmHeapHint) {
    fixes.push({
      type: 'gradle.properties',
      patch: { 'org.gradle.jvmargs': { kind: 'jvmargs', xmxMb: 4096, ensureFileEncodingUtf8: true } },
    });
    details.push('JVM Heap Optimization: Raise daemon memory ceiling to 4096mb to avoid garbage collection loops.');
  }

  const hasConfigCacheHint = buildMetrics.warnings.includes('Configuration cache invalidated') || expertKnowledge.some((k) => k.includes('Configuration cache'));
  if (hasConfigCacheHint) {
    fixes.push({ type: 'gradle.properties', property: 'org.gradle.configuration-cache', value: 'true' });
    details.push('Configuration Cache: Enable configuration cache to reuse execution configurations.');
  }

  const hasJetifierHint = expertKnowledge.some((k) => k.includes('Jetifier'));
  if (hasJetifierHint) {
    fixes.push({ type: 'gradle.properties', property: 'android.enableJetifier', value: 'false' });
    details.push('Disable Jetifier: Erase overhead rebuilding pre-AndroidX dependencies.');
  }

  const hasNonTransitiveRHint = expertKnowledge.some((k) => k.includes('non-transitive-r'));
  if (hasNonTransitiveRHint) {
    fixes.push({ type: 'gradle.properties', property: 'android.nonTransitiveRClass', value: 'true' });
    details.push('Non-Transitive R: Enable namespaced resources for fast module rebuilds.');
  }

  if (fixes.length === 0) {
    fixes.push({ type: 'gradle.properties', property: 'org.gradle.caching', value: 'true' });
    fixes.push({ type: 'gradle.properties', property: 'org.gradle.parallel', value: 'true' });
    fixes.push({ type: 'gradle.properties', property: 'kotlin.incremental', value: 'true' });
    details.push('Standard Optimizations: Enable parallel tasks, build caching, and incremental compilation.');
  }

  return { fixes, details };
}

function buildLocalExpertReport(buildMetrics, expertKnowledge) {
  const { fixes, details } = buildLocalExpertFixes(buildMetrics, expertKnowledge);

  const summaryLines = [];
  summaryLines.push('### Local Expert Build Performance Analysis');
  summaryLines.push('');
  summaryLines.push('#### Build Info:');
  summaryLines.push(`- Status: ${buildMetrics.buildStatus || 'UNKNOWN'}`);
  summaryLines.push(`- Total Time: ${buildMetrics.totalTime || 'Unknown'}`);
  summaryLines.push(`- Config Time: ${buildMetrics.configTime || 'Unknown'}`);
  summaryLines.push('');
  summaryLines.push('#### Slowest Tasks:');
  summaryLines.push(
    buildMetrics.slowTasks.length > 0
      ? buildMetrics.slowTasks.map((t) => `- \`${t.path}\`: ${t.duration}s`).join('\n')
      : '- No slow tasks recorded (duration info absent).'
  );
  summaryLines.push('');
  summaryLines.push('#### Identified Warnings/Bottlenecks:');
  summaryLines.push(
    buildMetrics.warnings.length > 0
      ? buildMetrics.warnings.map((w) => `- **${w}**`).join('\n')
      : '- None specifically matched.'
  );
  summaryLines.push('');
  summaryLines.push('#### Recommendations:');
  summaryLines.push(details.join('\n\n'));
  summaryLines.push('');
  summaryLines.push('FIX_JSON');
  summaryLines.push('```json');
  summaryLines.push(JSON.stringify({ fixes }, null, 2));
  summaryLines.push('```');

  return { reportMarkdown: summaryLines.join('\n'), fixes };
}

module.exports = {
  buildLocalExpertFixes,
  buildLocalExpertReport,
};
