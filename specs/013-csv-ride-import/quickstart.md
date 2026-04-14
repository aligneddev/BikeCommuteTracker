# Developer Quickstart: CSV Ride Import

**Feature**: 013-csv-ride-import
**Branch**: `013-csv-ride-import`
**Date**: 2026-04-08

## Overview

This feature adds a Settings-linked CSV import page that supports preview validation, duplicate
resolution, long-running processing with milestone progress, cache-first enrichment with external
fallback, and cooperative cancellation.

## Prerequisites

- DevContainer running
- App launch: `dotnet run --project src/BikeTracking.AppHost`
- Existing login and ride flows available
- Follow strict TDD gate: failing tests first, run red, user confirms failures before implementation

## Implementation order

### Step 1: Define contracts first

Create backend contracts and endpoint signatures before service code.

```text
src/BikeTracking.Api/Contracts/
  ImportContracts.cs
src/BikeTracking.Api/Endpoints/
  ImportEndpoints.cs
```

Lock request/response models for:
- preview upload
- duplicate resolution/start
- status query
- cancellation
- completion summary
- progress notification payload

### Step 2: Persistence and migration

Add import job/row entities and EF mappings.

```text
src/BikeTracking.Api/Infrastructure/Persistence/Entities/
  ImportJobEntity.cs
  ImportRowEntity.cs
src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
src/BikeTracking.Api/Infrastructure/Persistence/Migrations/
  {timestamp}_AddCsvRideImport.cs
```

Update migration policy test.

### Step 3: Parser and validation pipeline

Build CSV parse/normalize/validate helpers.

```text
src/BikeTracking.Api/Application/Imports/
  CsvParser.cs
  CsvValidationRules.cs
```

Rules to enforce:
- required columns `Date` + `Miles`
- case-insensitive headers
- date parsing per spec assumptions
- miles range `(0,200]`
- optional positive time when present

### Step 4: Duplicate workflow

Implement duplicate detection and resolution orchestration.

```text
src/BikeTracking.Api/Application/Imports/DuplicateResolutionService.cs
```

Key behavior:
- duplicate key = date + miles
- per-row resolution (`keep-existing` or `replace-with-import`)
- optional override-all bypass

### Step 5: Import orchestration and enrichment

Implement long-running processor.

```text
src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs
```

Behavior:
- process valid rows
- create/update rides via existing ride services
- cache-first enrichment for gas/weather
- external lookup on cache miss
- retry once then skip enrichment field
- throttle external lookups to 4 calls/sec

### Step 6: Progress, ETA, cancellation

Implement milestone notifier and ETA estimator.

```text
src/BikeTracking.Api/Application/Imports/
  ImportProgressEstimator.cs
src/BikeTracking.Api/Application/Notifications/
  ImportProgressNotifier.cs
```

Behavior:
- notify at 25/50/75/100
- ETA shown in 5-minute increments when stable
- cancellation stops remaining rows, keeps imported rows

### Step 7: Frontend route and UX

```text
src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx
src/BikeTracking.Frontend/src/components/import-rides/
  DuplicateResolutionDialog.tsx
  ImportProgressPanel.tsx
src/BikeTracking.Frontend/src/services/import-api.ts
src/BikeTracking.Frontend/src/App.tsx
```

UX expectations:
- upload + preview
- row-level validation display
- duplicate resolution dialog with override-all
- progress + ETA + completion/cancellation summaries

## TDD-first test checklist

Write and run these failing tests first.

### Backend unit

- CSV parser accepts case-insensitive headers
- Parser rejects missing required columns
- Row validation reports field-level errors and allows valid rows
- Duplicate detector flags date+miles matches only
- Override-all bypasses duplicate prompts
- Enrichment uses cache first
- Enrichment calls external on cache miss
- Enrichment retries once then skips field on second failure
- Throttle enforces max 4 external calls/second
- ETA rounds to 5-minute increments after stable sample
- Cancellation keeps imported rows and stops further processing

### Backend integration / endpoint

- Preview endpoint persists job and row states
- Start endpoint enforces ownership and valid status transitions
- Status endpoint returns reconnect-safe state
- Cancel endpoint transitions job correctly and is idempotent
- Completion summary counts imported/skipped/failed rows correctly

### Frontend unit

- Settings page shows Import Rides navigation
- Import page renders preview errors and valid row counts
- Duplicate dialog displays existing vs incoming row details
- Override-all toggle alters start payload
- Progress panel updates milestone percentages and ETA text
- Cancel action requests cancellation and renders partial summary

### E2E

- Upload -> preview -> start -> completion happy path
- Duplicate conflict path with keep-existing
- Duplicate conflict path with override-all
- Long-running progress milestone updates visible
- Cancellation mid-import results in partial completion summary

## Verification commands

Run after each meaningful slice:

```bash
dotnet test BikeTracking.slnx
cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit
cd src/BikeTracking.Frontend && npm run test:e2e
```

Formatting before merge:

```bash
csharpier format .
```
