# Contributing

Thanks for helping make `droidperf` better.

## Development setup

```bash
npm install
```

## Run locally

```bash
node bin/droidperf.js audit --path /path/to/android/project --no-color
node bin/droidperf.js fix --path /path/to/android/project --dry-run --no-color
```
# Test analyze command
node bin/droidperf.js analyze --build-log ./build.log --api-key YOUR_KEY
node bin/droidperf.js analyze --build-log ./build.log --api-key YOUR_KEY --apply --dry-run

## Tests + lint

```bash
npm test
npm run lint
```

## Release process (maintainers)

1) Make sure CI is green on `master`.
2) Bump version + create tag:

```bash
npm version patch
git push --follow-tags
```

Pushing a `vX.Y.Z` tag triggers the GitHub Actions release workflow which publishes to npm.

