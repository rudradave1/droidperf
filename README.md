# Droidperf

> **Android Gradle Performance Auditor & Auto-Fixer**
>
> Find slow Gradle configuration issues, estimate their build-time
> impact, and safely apply fixes with a single command.
>
> **Free & Open Source. Safe by design.**

------------------------------------------------------------------------

## Why Droidperf?

Every unnecessary second in your Gradle build compounds throughout the
day.

**Droidperf** audits Android and Kotlin Multiplatform Gradle projects
for common performance bottlenecks and can safely fix many of them while
preserving your existing configuration.

### Highlights

-   ⚡ Speed up Gradle builds
-   🔍 Detect high-impact performance issues
-   🛡️ Apply safe, reversible fixes
-   🤖 AI-assisted Gradle build log analysis
-   📊 Interactive web dashboard
-   🚀 CI/CD ready
-   🆓 Completely free and open source

------------------------------------------------------------------------

## Features

-   Audit Android, KMP and Flutter Android projects
-   Detect configuration cache, build cache, Kotlin incremental, JVM,
    daemon and parallel execution issues
-   Auto-fix safe Gradle configuration problems
-   Preview every change before applying (`--dry-run`)
-   Analyze Gradle build logs locally (offline) or with AI
-   Interactive browser dashboard
-   Machine-readable JSON output
-   Automatic verification and rollback
-   Groovy & Kotlin DSL support

------------------------------------------------------------------------

## Why use Droidperf?

Unlike generic Gradle guides, Droidperf doesn't just tell you what is
wrong---it tells you:

-   What is slowing your build
-   How much time it may be costing
-   Which fixes are safe
-   How to preview changes
-   How to apply them automatically

Everything is designed to be transparent and reversible.

------------------------------------------------------------------------

## Example Output

``` text
✓ Project Health Score: 82/100

Found 7 issues

CRITICAL  Configuration Cache disabled
CRITICAL  Build Cache disabled
HIGH      Parallel Execution disabled
HIGH      Kotlin Incremental disabled

Estimated build time wasted

≈ 3.0 min/build
≈ 61 min/day
≈ 22+ hours/month
```

------------------------------------------------------------------------

## AI Build Log Analysis

Analyze a Gradle build log in seconds.

Choose between:

-   **Offline Expert Mode** --- no API key required
-   **AI Mode** --- OpenRouter-compatible models

If AI is unavailable, Droidperf automatically falls back to its built-in
expert knowledge base.

------------------------------------------------------------------------

## Safety First

Every automatic fix is intentionally conservative.

Before modifying your project, Droidperf:

-   Creates timestamped backups
-   Supports `--dry-run` previews
-   Verifies the Gradle configuration
-   Automatically restores changes if verification fails

No hidden changes. No risky optimizations.

------------------------------------------------------------------------

## Supported Projects

-   Android
-   Kotlin Multiplatform
-   Flutter (`android/`)
-   Groovy DSL
-   Kotlin DSL
-   Version Catalogs
-   Composite Builds (best effort)

------------------------------------------------------------------------

## Philosophy

> **Save build time, not weekends debugging Gradle.**

Droidperf prioritizes:

-   Safe defaults
-   Explainable diagnostics
-   Conservative fixes
-   Easy rollback
-   Developer trust over aggressive optimization

------------------------------------------------------------------------

## Quick Start

``` bash
npx droidperf audit /path/to/project

npx droidperf fix /path/to/project --dry-run

npx droidperf fix /path/to/project
```

------------------------------------------------------------------------

## Perfect For

-   Android developers
-   Kotlin Multiplatform teams
-   CI/CD pipelines
-   Large multi-module projects
-   Flutter teams with native Android modules

------------------------------------------------------------------------

## Free Today

Droidperf is currently **100% free and open source**.

The goal is simple:

-   Help Android developers build faster
-   Make Gradle performance easier to understand
-   Automate safe optimizations without sacrificing control
