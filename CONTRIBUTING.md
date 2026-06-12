# Contributing to BikeTracking

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to drive
**automated semantic versioning** and **changelog generation** via
[release-please](https://github.com/googleapis/release-please).

Every commit merged to `main` **must** use one of the following prefixes:

### Commit prefix → version bump mapping

| Prefix | Bump | Example commit message |
|--------|------|------------------------|
| `feat:` | **minor** (`1.1.0 → 1.2.0`) | `feat: add cadence sensor support` |
| `fix:` | **patch** (`1.1.0 → 1.1.1`) | `fix: correct elapsed time on paused rides` |
| `chore:` | patch | `chore: update Node.js to 24` |
| `docs:` | patch | `docs: add API authentication section to README` |
| `refactor:` | patch | `refactor: extract RideRepository from service layer` |
| `style:` | patch | `style: apply Prettier formatting to dashboard components` |
| `test:` | patch | `test: add unit tests for distance calculation` |
| `perf:` | patch | `perf: debounce GPS position updates` |
| `ci:` | patch | `ci: add Tauri debug build check to PR workflow` |
| `feat!:` or `fix!:` | **major** (`1.1.0 → 2.0.0`) | `feat!: replace REST API with GraphQL` |
| `BREAKING CHANGE:` footer | **major** | *(any prefix)* + `BREAKING CHANGE: removed /rides endpoint` in commit body |

> **Note**: release-please will not open a release PR until at least one conventional commit
> has been merged to `main` since the previous release.

### Examples

```
feat: add live elevation gain tracking to dashboard

fix: stop timer continuing after app is backgrounded on Android

chore(deps): bump @tauri-apps/cli from 2.11.1 to 2.11.2

feat!: replace SQLite storage with event-sourced backend

BREAKING CHANGE: existing biketracking.local.db files are not migrated automatically.
```

## Release workflow

See [`quickstart.md`](specs/023-pwa-desktop-packaging/quickstart.md) Scenario 6 for step-by-step
release notes validation after a conventional commit is merged to `main`.

1. Push a conventional commit to `main` (via a PR).
2. `release-please.yml` creates (or updates) a release PR titled
   `chore(main): release {version}` with bumped versions in `package.json` and
   `src-tauri/Cargo.toml`, and an updated `CHANGELOG.md`.
3. A maintainer reviews and merges the release PR.
4. release-please pushes the git tag `v{version}` and creates a GitHub Release draft.
5. `release.yml` triggers automatically on the tag push, builds the platform installers,
   and attaches them to the GitHub Release.

## Local development

See [`specs/023-pwa-desktop-packaging/quickstart.md`](specs/023-pwa-desktop-packaging/quickstart.md)
for step-by-step local build and DevContainer setup instructions.
