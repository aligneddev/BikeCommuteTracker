# Bike Tracking Agent Guide

Bike Tracking is a local-first commuter app that records rides and computes savings using a .NET Minimal API, F# domain logic, and a React TypeScript frontend.

## Always Applies
- Work inside the DevContainer only.
- Run the app with `dotnet run --project src/BikeTracking.AppHost`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`aligneddev/BikeCommuteTracker`); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
