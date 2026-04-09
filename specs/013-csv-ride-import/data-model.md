# Data Model: CSV Ride Import

**Feature**: 013-csv-ride-import
**Date**: 2026-04-08
**Status**: Complete

## Overview

This feature introduces a persisted import workflow with two new entities plus additive ride-import mapping rules.

1. `ImportJob` tracks one CSV import lifecycle for a rider.
2. `ImportRow` tracks parsed row state, validation, duplicate metadata, and resolution.
3. Existing ride entities/events are reused for final persisted rides.

## Entity: ImportJob

Represents one uploaded CSV import request.

| Field | Type | Rules / Notes |
|------|------|----------------|
| `Id` | `long` | Primary key |
| `RiderId` | `long` | Required; rider-scoped ownership |
| `FileName` | `string` | Required; stored for traceability |
| `TotalRows` | `int` | `>= 0` |
| `ProcessedRows` | `int` | `0..TotalRows` |
| `ImportedRows` | `int` | `>= 0` |
| `SkippedRows` | `int` | `>= 0` |
| `FailedRows` | `int` | `>= 0` |
| `Status` | `string enum` | `pending`, `validating`, `awaiting-confirmation`, `processing`, `completed`, `cancelled`, `failed` |
| `OverrideAllDuplicates` | `bool` | Default `false` |
| `EtaMinutesRounded` | `int?` | Rounded to 5-minute increments when available |
| `CreatedAtUtc` | `DateTime` | Required |
| `StartedAtUtc` | `DateTime?` | Set when processing begins |
| `CompletedAtUtc` | `DateTime?` | Set on completed/cancelled/failed |
| `LastError` | `string?` | Failure summary, if any |

### Validation invariants

- `ProcessedRows <= TotalRows`
- `ImportedRows + SkippedRows + FailedRows <= ProcessedRows`
- `Status=completed|cancelled|failed` requires `CompletedAtUtc`

## Entity: ImportRow

Represents one parsed CSV row and its processing state.

| Field | Type | Rules / Notes |
|------|------|----------------|
| `Id` | `long` | Primary key |
| `ImportJobId` | `long` | FK to `ImportJob` |
| `RowNumber` | `int` | 1-based CSV row index (excluding header) |
| `RideDateLocal` | `DateOnly?` | Required for valid rows |
| `Miles` | `decimal?` | Required for valid rows; `(0,200]` |
| `RideMinutes` | `int?` | Optional; positive when present |
| `Temperature` | `decimal?` | Optional |
| `TagsRaw` | `string?` | Optional raw string from CSV |
| `Notes` | `string?` | Optional |
| `ValidationStatus` | `string enum` | `valid`, `invalid` |
| `ValidationErrorsJson` | `string?` | Structured error payload |
| `DuplicateStatus` | `string enum` | `none`, `duplicate`, `resolved` |
| `DuplicateResolution` | `string enum?` | `keep-existing`, `replace-with-import`, `override-all` |
| `ProcessingStatus` | `string enum` | `pending`, `processed`, `skipped`, `failed` |
| `ExistingRideIdsJson` | `string?` | Existing ride IDs for duplicate dialog context |
| `CreatedRideId` | `long?` | Created/updated ride ID when processed |

### Validation invariants

- `ValidationStatus=invalid` implies `ValidationErrorsJson` not null
- `DuplicateStatus=duplicate` implies one or more existing ride references
- `ProcessingStatus=processed` implies `ValidationStatus=valid`

## Derived model: DuplicateKey

Duplicate detection key per incoming row.

| Component | Source |
|----------|--------|
| `Date` | `ImportRow.RideDateLocal` |
| `Miles` | `ImportRow.Miles` |

A row is duplicate when an existing rider ride matches both date and miles.

## Derived model: ImportProgressSnapshot

Computed status pushed to client at milestones.

| Field | Type | Notes |
|------|------|-------|
| `JobId` | `long` | Correlates updates |
| `Percent` | `int` | Emitted at 25/50/75/100 |
| `ProcessedRows` | `int` | Current processed count |
| `TotalRows` | `int` | Denominator |
| `EtaRoundedMinutes` | `int?` | Rounded to nearest 5 minutes |
| `Status` | `string` | Current job status |

## Relationship map

- One rider has many `ImportJob` records.
- One `ImportJob` has many `ImportRow` records.
- One `ImportRow` may create or update one ride through existing ride services.

## State transitions

### ImportJob state flow

`pending -> validating -> awaiting-confirmation -> processing -> completed`

Alternative terminal paths:
- `processing -> cancelled`
- `processing -> failed`
- `validating -> failed` (fatal parse/infrastructure errors)

### ImportRow state flow

`pending -> (invalid -> failed)`
`pending -> (valid + non-duplicate -> processed)`
`pending -> (valid + duplicate -> resolved -> processed|skipped)`

### Cancellation behavior

- Cancellation request marks job cancellation intent.
- Worker stops after current row boundary.
- Already processed rows remain persisted.
- Job ends in `cancelled` with partial summary.
