# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- N/A

## 0.1.1

- Production hardening: composite builds + version catalog scanning, safer JVM args patching, `--dry-run` unified diff, CI/CD workflows, `--json` / `--no-color`, and test fixtures.

## 2.1.0

- Smart Log Pre-processing: Extracts slowest tasks and build metrics to improve LLM accuracy.
- Expert Knowledge Base (RAG): Injects relevant Gradle performance patterns into the AI prompt.
- Improved Prompting: More structured and data-driven LLM analysis.
- Faster Analysis: Reduced token usage by sending only relevant log signals.

## 2.0.0

- AI-powered build analysis via `analyze` command
- Auto-apply AI fixes with `--apply`
- Dry-run preview with `--apply --dry-run`
- Model selection with `--model`
- Report saved to `droidperf-report.md`
- Shared backup utility across audit and analyze commands