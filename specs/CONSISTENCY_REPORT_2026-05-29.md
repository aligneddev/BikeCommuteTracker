# Speckit Consistency Report

Date: 2026-05-29
Scope: Cross-file consistency check across `specs/*` feature packs (`spec.md`, `plan.md`, `tasks.md`, and checklist presence where applicable).

## Executive Summary

The highest-risk architecture contradictions from the prior audit are now resolved (Vue/React drift in scaffold pack, MSAL reference in 004 plan, Azure deployment drift in 019 plan, login miles-prefill drift in 003 spec).

Open issues are now primarily governance hygiene around duplicate ID families.

## Findings (Current)

### 1) Duplicate ID family still exists by design and must be governed
- Severity: Medium
- Evidence:
- `specs/001-project-scaffold/`
- `specs/001-create-a-per-user/`
- `specs/009-create-a-per-user/`
- Risk: ID ambiguity during human review and automation if no canonical registry exists.
- Action taken: Added `specs/REGISTRY.md` and marked `001-create-a-per-user` as superseded, `009-create-a-per-user` as canonical.
- Remaining action: Keep registry updated with every new spec folder.

### 2) Missing sequence slots required explicit policy
- Severity: Medium
- Evidence:
- Previously missing numeric slots 017 and 021 under `specs/`
- Risk: Future backfill can break traceability and references.
- Action taken:
- Added `specs/017-reserved-slot/README.md`
- Added `specs/021-reserved-slot/README.md`
- Added immutable numbering policy in `specs/REGISTRY.md`

### 3) Duplicate ID family remains the primary residual governance risk
- Severity: Low
- Evidence:
- `specs/001-project-scaffold/`
- `specs/001-create-a-per-user/`
- `specs/009-create-a-per-user/`
- Risk: Reader confusion if registry is not used as the source of truth.
- Recommended next action:
- Enforce registry updates in every spec-related PR.

## Closed Since Last Audit

- Scaffold frontend stack terminology aligned to React in:
- `specs/001-project-scaffold/spec.md`
- `specs/001-project-scaffold/plan.md`
- `specs/001-project-scaffold/tasks.md`
- `specs/001-project-scaffold/checklists/requirements.md`
- Removed out-of-scope login prefill requirement from:
- `specs/003-user-login/spec.md`
- Replaced incorrect auth dependency wording in:
- `specs/004-create-the-record-ride-mvp/plan.md`
- Removed non-local deployment drift in:
- `specs/019-ride-difficulty-wind/plan.md`
- Added missing checklist artifact:
- `specs/016-csv-expense-import/checklists/requirements.md`
- Added migration and compatibility guidance for 008 -> 020 supersession:
- `specs/020-improve-ride-preset-options/spec.md`
- Completed status hygiene pass for fully completed feature packs:
- `specs/002-user-signup-pin/spec.md`
- `specs/003-user-login/spec.md`
- `specs/004-create-the-record-ride-mvp/spec.md`
- `specs/005-view-history-page/spec.md`
- `specs/006-edit-ride-history/spec.md`
- `specs/008-quick-ride-entry/spec.md`
- `specs/009-create-a-per-user/spec.md`
- `specs/010-gas-price-lookup/spec.md`
- `specs/011-ride-weather-data/spec.md`
- `specs/012-dashboard-stats/spec.md`
- `specs/014-ride-notes/spec.md`
- `specs/019-ride-difficulty-wind/spec.md`
- `specs/020-improve-ride-preset-options/spec.md`
- `specs/022-pwa-local-install/spec.md`

## Operational Rule (Going Forward)

Before implementation starts for any new spec:
1. Confirm the folder is registered in `specs/REGISTRY.md`.
2. Confirm no existing spec is superseded without an explicit note.
3. Confirm the spec pack has at minimum: `spec.md`, `plan.md`, `tasks.md`, and `checklists/requirements.md` (or documented exception).
