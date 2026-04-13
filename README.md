# droidperf

Android Gradle performance auditor and auto-fixer.

One command finds what's slowing your builds and wasting your CI money. Another command fixes it.

## Install / run

Run directly (after publishing to npm):

```bash
npx droidperf audit --path /path/to/android/project
npx droidperf fix --path /path/to/android/project
npx droidperf fix --path /path/to/android/project --dry-run
```

This repo is the CLI source. To run locally:

```bash
npm install
node bin/droidperf.js audit --path /path/to/android/project
node bin/droidperf.js fix --path /path/to/android/project
node bin/droidperf.js fix --path /path/to/android/project --dry-run
```

## What it checks

- Configuration cache disabled (CRITICAL)
- Build cache disabled (CRITICAL)
- Parallel execution disabled (HIGH)
- Kotlin incremental disabled (HIGH)
- JVM heap too low (MEDIUM)
- Configure on demand disabled (MEDIUM)
- Gradle daemon disabled (LOW)
- Dynamic dependency versions (LOW, audit-only)

## Safety

Before writing, `droidperf fix` saves a timestamped backup to `.droidperf-backup/`.

Example restore:

```bash
cp .droidperf-backup/gradle.properties.<timestamp>.bak gradle.properties
```

## Notes / limitations

- Fixes are intentionally limited to safe `gradle.properties` toggles. Dynamic dependency versions are reported but not auto-upgraded.
- JVM args fix updates/sets `-Xmx` and ensures `-Dfile.encoding=UTF-8`, while preserving existing JVM args flags.

## Output formats

- `--no-color`: disable ANSI colors (CI-friendly)
- `--json`: machine-readable output for audits/fixes

