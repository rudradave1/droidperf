# droidperf (one-pager)

If you’ve ever thought “Gradle feels slower than it should,” you’re probably right.

Most Android repos ship with performance switches left off. The cost isn’t abstract:

- **Developer time**: slower incremental builds multiply across the day.
- **CI cost**: longer pipelines burn minutes on every PR.

`droidperf` makes this measurable and fixable in minutes.

## What it does

1) **Audits** your repo for common Gradle build-time misconfigurations.
2) **Estimates savings** per build.
3) **Fixes safely** (with backups + diffs) so you can ship it confidently.

## Works for

- Android Gradle projects (Groovy + Kotlin DSL)
- Kotlin Multiplatform (KMP) projects (Gradle-based)
- Flutter repos (audits the `android/` Gradle subproject)

## Try it

```bash
npx droidperf audit --path /path/to/your/android/project --no-color
npx droidperf fix --path /path/to/your/android/project --dry-run --no-color
```

## Customize it (teams)

Drop a `.droidperfrc.json` into your repo root to tune recommendations and disable rules you don’t want enforced:

```json
{
  "buildsPerDay": 20,
  "recommend": { "jvmXmxMb": 4096 },
  "rules": { "enabled": { "configure-on-demand": false } }
}
```

## Why it’s trustworthy

- **Transparent changes**: `--dry-run` prints unified diffs of what would change.
- **Rollback built-in**: writes create timestamped backups in `.droidperf-backup/`.
- **Granular control**: apply only what you want (`--only`) or skip rules (`--exclude`).
- **CI-proven**: repo includes tests and a CI workflow that runs on every PR/push.

## What it changes (by design)

`droidperf fix` is intentionally conservative. It only touches `gradle.properties` with safe toggles and a non-destructive JVM args patch (updates `-Xmx`, preserves other flags).

Dynamic dependency versions are detected and reported, but **not auto-upgraded**.

