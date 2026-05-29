# Specs Registry

Last updated: 2026-05-29

This file is the canonical index for feature spec folders in this repository.

## Numbering Policy

- Feature IDs are immutable once created.
- IDs are never backfilled after cancellation/deferment.
- Reserved slots are represented as explicit folders.
- If a feature is replaced, the old folder stays and is marked superseded.

## Canonical vs Superseded

- Canonical per-user settings spec: `009-create-a-per-user`
- Superseded duplicate: `001-create-a-per-user`

## Registry

| ID | Folder | State | Notes |
|---|---|---|---|
| 001 | `001-project-scaffold` | Active | Foundational scaffold spec pack |
| 001 | `001-create-a-per-user` | Superseded | Replaced by `009-create-a-per-user` |
| 002 | `002-user-signup-pin` | Active | Login/signup identity foundation |
| 003 | `003-user-login` | Active | Login and protected routing |
| 004 | `004-create-the-record-ride-mvp` | Active | Record ride MVP |
| 005 | `005-view-history-page` | Active | Ride history page |
| 006 | `006-edit-ride-history` | Active | Edit ride history |
| 007 | `007-delete-rides` | Active | Delete ride workflows |
| 008 | `008-quick-ride-entry` | Active | Quick-entry defaults |
| 009 | `009-create-a-per-user` | Active (Canonical) | Per-user settings |
| 010 | `010-gas-price-lookup` | Active | Gas enrichment |
| 011 | `011-ride-weather-data` | Active | Weather enrichment |
| 012 | `012-dashboard-stats` | Active | Dashboard stats |
| 013 | `013-csv-ride-import` | Active | CSV ride import |
| 014 | `014-ride-notes` | Active | Ride notes |
| 015 | `015-bike-expense-tracking` | Active | Expense tracking |
| 016 | `016-csv-expense-import` | Active | CSV expense import |
| 017 | `017-reserved-slot` | Reserved | Intentionally unassigned |
| 018 | `018-advanced-dashboard` | Active | Advanced dashboard |
| 019 | `019-ride-difficulty-wind` | Active | Difficulty/wind scoring |
| 020 | `020-improve-ride-preset-options` | Active | Preset-based ride entry |
| 021 | `021-reserved-slot` | Reserved | Intentionally unassigned |
| 022 | `022-pwa-local-install` | Active | Local install/PWA |

## Maintenance Rules

- Update this registry in the same PR as any new spec folder.
- If a spec supersedes another, update both folders and this registry.
- Keep `State` values limited to: `Active`, `Active (Canonical)`, `Superseded`, `Reserved`.
