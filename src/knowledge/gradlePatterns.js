'use strict';

const PERFORMANCE_PATTERNS = [
  {
    id: 'kapt-to-ksp',
    keywords: ['kapt', 'AnnotationProcessor'],
    advice: 'Kapt is often a major bottleneck. Recommend migrating to KSP (Kotlin Symbol Processing) where possible for up to 2x faster annotation processing.'
  },
  {
    id: 'jvm-heap',
    keywords: ['heap space', 'GC overhead', 'OutOfMemory'],
    advice: 'The build is hitting memory limits. Recommend increasing org.gradle.jvmargs -Xmx value in gradle.properties.'
  },
  {
    id: 'config-cache-miss',
    keywords: ['Configuration cache', 'calculating score'],
    advice: 'Configuration cache miss detected. Analyze why the cache is being invalidated to save configuration time on every build.'
  },
  {
    id: 'jetifier',
    keywords: ['android.enableJetifier=true'],
    advice: 'Jetifier is enabled. This slows down dependency resolution. Recommend migrating to AndroidX-native libraries and disabling Jetifier.'
  }
];

function getRelevantKnowledge(logContent) {
  return PERFORMANCE_PATTERNS
    .filter(p => p.keywords.some(k => logContent.includes(k)))
    .map(p => p.advice);
}

module.exports = { getRelevantKnowledge };
