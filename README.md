# droidperf

[![npm](https://img.shields.io/npm/v/droidperf)](https://www.npmjs.com/package/droidperf)
[![CI](https://github.com/rudradave1/droidperf/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/rudradave1/droidperf/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/droidperf)](./LICENSE)

Android Gradle performance auditor and auto-fixer.

One command finds what’s slowing your builds and wasting CI money. Another command fixes it.

## Quickstart

```bash
npx droidperf audit --path /path/to/your/android/project
npx droidperf fix --path /path/to/your/android/project --dry-run
npx droidperf fix --path /path/to/your/android/project
```

## Example output

```text
Scanning your Android project...

Found 6 issues costing you ~2.3 minutes per build:

[CRITICAL] Configuration cache disabled — +45s per build
[CRITICAL] Build cache disabled — +32s per build
[HIGH]     Parallel execution disabled — +38s per build
[HIGH]     Kotlin incremental disabled — +28s per build
[MEDIUM]   JVM heap too low (512mb) — recommend 4096mb
[LOW]      Dynamic dependency versions found in 3 modules

Estimated waste: 2.3 min/build × 20 builds/day = 46 min/day

Run 'droidperf fix' to apply all fixes automatically.
```

## What it checks

- Configuration cache disabled (CRITICAL)
- Build cache disabled (CRITICAL)
- Parallel execution disabled (HIGH)
- Kotlin incremental disabled (HIGH)
- JVM heap too low (MEDIUM)
- Configure on demand disabled (MEDIUM)
- Gradle daemon disabled (LOW)
- Dynamic dependency versions (LOW, audit-only; scans `build.gradle*` and `gradle/libs.versions.toml`)

## Usage

- **Audit**:

```bash
npx droidperf audit --path /path/to/your/android/project
```

- **Apply fixes**:

```bash
npx droidperf fix --path /path/to/your/android/project
```

- **Preview changes (recommended first)**:

```bash
npx droidperf fix --path /path/to/your/android/project --dry-run
```

- **Machine-readable output (CI)**:

```bash
npx droidperf audit --path /path/to/your/android/project --json
npx droidperf fix --path /path/to/your/android/project --dry-run --json
```

## Safety

Before writing, `droidperf fix` saves a timestamped backup to `.droidperf-backup/`.

Example restore:

```bash
cp .droidperf-backup/gradle.properties.<timestamp>.bak gradle.properties
```

## What it changes

`droidperf fix` only applies safe edits to `gradle.properties`:

- `org.gradle.configuration-cache=true`
- `org.gradle.caching=true`
- `org.gradle.parallel=true`
- `kotlin.incremental=true`
- `org.gradle.configureondemand=true`
- `org.gradle.daemon=true`
- `org.gradle.jvmargs`: updates/sets `-Xmx` (4096m) and ensures `-Dfile.encoding=UTF-8` **without deleting your existing JVM args flags**

Dynamic dependency versions are reported but not auto-fixed.

## Notes

- **Supported**: Gradle Groovy + Kotlin DSL, version catalogs, composite builds (`includeBuild(...)` best-effort).
- **Guardrails**: very large files are skipped to keep scans fast and safe.

## Output formats

- `--no-color`: disable ANSI colors (CI-friendly)
- `--json`: machine-readable output for audits/fixes

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

## Local development

```bash
npm install
node bin/droidperf.js audit --path /path/to/android/project --no-color
node bin/droidperf.js fix --path /path/to/android/project --dry-run --no-color
```

