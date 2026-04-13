# droidperf

[![npm](https://img.shields.io/npm/v/droidperf)](https://www.npmjs.com/package/droidperf)
[![CI](https://github.com/rudradave1/droidperf/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/rudradave1/droidperf/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/droidperf)](./LICENSE)

Android Gradle performance auditor and auto-fixer.

Audit and safely fix common Gradle build-time misconfigurations in Android projects.

It’s designed to be boring in the best way: conservative fixes, transparent diffs, and easy rollback.

## Quickstart

```bash
npx droidperf audit /path/to/your/android/project
npx droidperf fix /path/to/your/android/project --dry-run
npx droidperf fix /path/to/your/android/project
```

Flutter repo? Point at the repo root — `droidperf` will auto-detect and audit the `android/` Gradle subproject.

## One-pager

If you want a short “why/what/how” you can share, see [`docs/ONE_PAGER.md`](./docs/ONE_PAGER.md).

## Example output

```text
Scanning your Android project...

Found 7 issues costing you ~3.0 minutes per build:

[CRITICAL] Configuration cache disabled — +45s per build
[CRITICAL] Build cache disabled — +32s per build
[HIGH]     Parallel execution disabled — +38s per build
[HIGH]     Kotlin incremental disabled — +28s per build
[MEDIUM]   JVM heap too low — 2048mb — recommend 4096mb
[MEDIUM]   Configure on demand disabled — +12s per build
[LOW]      Gradle daemon disabled — +8s per build

Estimated waste: 3.0 min/build × 20 builds/day = 61 min/day

Run 'droidperf fix' to apply all fixes automatically.
```

Preview changes safely first:

```bash
npx droidperf fix /path/to/your/android/project --dry-run
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
npx droidperf audit /path/to/your/android/project
```

- **Config (optional)**: add `.droidperfrc.json` (or `droidperf.config.json`) at the project root.

```json
{
  "buildsPerDay": 20,
  "recommend": { "jvmXmxMb": 4096 },
  "rules": {
    "enabled": {
      "configure-on-demand": false
    }
  }
}
```

You can also pass it explicitly:

```bash
npx droidperf audit /path/to/project --config /path/to/.droidperfrc.json
```

- **List rules** (IDs, severity, estimated savings, autofix availability):

```bash
npx droidperf audit --list-rules
```

- **Apply fixes**:

```bash
npx droidperf fix /path/to/your/android/project
```

- **Preview changes (recommended first)**:

```bash
npx droidperf fix /path/to/your/android/project --dry-run
```

- **Apply only some rules**:

```bash
npx droidperf fix /path/to/your/android/project --only configuration-cache,build-cache --dry-run
npx droidperf fix /path/to/your/android/project --exclude jvm-heap
```

- **Machine-readable output (CI)**:

```bash
npx droidperf audit /path/to/your/android/project --json
npx droidperf fix /path/to/your/android/project --dry-run --json
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

- **Supported**: Android Gradle projects (Groovy + Kotlin DSL), KMP (Gradle-based), version catalogs, composite builds (`includeBuild(...)` best-effort), and Flutter’s Android module (auto-detects `android/`).
- **Guardrails**: very large files are skipped to keep scans fast and predictable.

## Output formats

- `--no-color`: disable ANSI colors (CI-friendly)
- `--json`: machine-readable output for audits/fixes

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Security

See [`SECURITY.md`](./SECURITY.md).

## Maintainer

Maintained by **Rudra Dave**.

- **Issues**: use GitHub Issues for bugs/features
- **Security**: see [`SECURITY.md`](./SECURITY.md)
- **Contact**: `rudramordan@gmail.com`
- **Updates**: `https://www.linkedin.com/in/rudradave/`

## Local development

```bash
npm install
node bin/droidperf.js audit --path /path/to/android/project --no-color
node bin/droidperf.js fix --path /path/to/android/project --dry-run --no-color
```

