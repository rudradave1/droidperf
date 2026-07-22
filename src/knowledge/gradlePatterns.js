'use strict';

const PERFORMANCE_PATTERNS = [
  {
    id: 'kapt-to-ksp',
    keywords: ['kapt', 'AnnotationProcessor', 'kaptGenerateStubs'],
    advice: 'Kapt is often a major bottleneck. Migrating from KAPT to KSP (Kotlin Symbol Processing) can speed up annotation processing by up to 2x.'
  },
  {
    id: 'jvm-heap',
    keywords: ['heap space', 'GC overhead', 'OutOfMemory', 'Expiring Daemon because JVM heap space is exhausted'],
    advice: 'The build daemon is hitting memory limits or experiencing high GC pauses. Recommend increasing the JVM max heap (-Xmx) size in gradle.properties (e.g., to 4g or 6g).'
  },
  {
    id: 'config-cache-miss',
    keywords: ['Configuration cache', 'calculating score', 'configuration cache cannot be reused'],
    advice: 'Configuration cache miss detected. Analyze the causes of cache invalidation (such as reading environment variables or system properties during configuration) to keep config times low.'
  },
  {
    id: 'jetifier',
    keywords: ['android.enableJetifier=true', 'jetifier'],
    advice: 'Jetifier is enabled. This forces Gradle to rewrite pre-AndroidX binaries at dependency resolution time, slowing down every build. Recommend upgrading dependencies to their modern counterparts and setting android.enableJetifier=false.'
  },
  {
    id: 'old-agp',
    keywords: ['com.android.tools.build:gradle:7.', 'com.android.tools.build:gradle:4.'],
    advice: 'You are using an older version of Android Gradle Plugin (AGP 7.x or below). Upgrading to AGP 8.x brings major build speedups, support for modern JDKs, and improved Configuration Cache support.'
  },
  {
    id: 'non-transitive-r',
    keywords: ['android.nonTransitiveRClass=false'],
    advice: 'Non-transitive R classes are disabled. Enabling this (android.nonTransitiveRClass=true) prevents the resource merger from copying R class IDs from dependencies into the app module, improving compile times during incremental builds.'
  },
  {
    id: 'build-features-buildconfig',
    keywords: ['android.defaults.buildfeatures.buildconfig=true'],
    advice: 'BuildConfig is enabled by default. If your modules do not need BuildConfig, disable it or set android.defaults.buildfeatures.buildconfig=false to skip generating unnecessary java sources.'
  },
  {
    id: 'parallel-workers',
    keywords: ['Parallel execution disabled'],
    advice: 'Gradle parallel execution is disabled. Enable org.gradle.parallel=true in gradle.properties to compile independent modules concurrently.'
  }
];

/**
 * Searches and compiles relevant expert performance advice based on log output and optionally project setup.
 */
function getRelevantKnowledge(logContent, project = null) {
  const adviceList = new Set();

  // Match against log patterns
  for (const pattern of PERFORMANCE_PATTERNS) {
    if (pattern.keywords.some(k => logContent.includes(k))) {
      adviceList.add(pattern.advice);
    }
  }

  // Match against project structure if available
  if (project) {
    // Check if Jetifier is enabled in gradle.properties
    if (project.gradleProperties && project.gradleProperties.text) {
      if (project.gradleProperties.text.includes('android.enableJetifier=true')) {
        const item = PERFORMANCE_PATTERNS.find(p => p.id === 'jetifier');
        if (item) adviceList.add(item.advice);
      }
      if (project.gradleProperties.text.includes('android.nonTransitiveRClass=false')) {
        const item = PERFORMANCE_PATTERNS.find(p => p.id === 'non-transitive-r');
        if (item) adviceList.add(item.advice);
      }
    }

    // Check build files for kapt usages
    let usesKapt = false;
    for (const file of project.buildFiles || []) {
      if (file.text && (file.text.includes('kotlin-kapt') || file.text.includes('org.jetbrains.kotlin.kapt'))) {
        usesKapt = true;
        break;
      }
    }
    if (usesKapt) {
      const item = PERFORMANCE_PATTERNS.find(p => p.id === 'kapt-to-ksp');
      if (item) adviceList.add(item.advice);
    }
  }

  return Array.from(adviceList);
}

module.exports = { getRelevantKnowledge, PERFORMANCE_PATTERNS };

