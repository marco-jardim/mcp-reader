# CI/CD + Releases + npm Publish

This repo uses GitHub Actions + Release Please.

## CI

Workflow: `.github/workflows/ci.yml`

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Releases

Workflow: `.github/workflows/release-please.yml`

- On every push to `main`, Release Please updates/open a release PR.
- Merging the release PR creates a GitHub Release and updates `CHANGELOG.md`.

## npm publish

On release creation, the workflow publishes to npm.

Required secret:

- `NPM_TOKEN`

Recommended:

- Use an automation token with publish permissions.
