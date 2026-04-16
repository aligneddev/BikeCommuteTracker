# Developer Quickstart: Ride Notes

**Feature**: 014-ride-notes
**Branch**: `014-ride-notes`
**Date**: 2026-04-14

## Overview

Implement note support in three paths:
1. Manual ride record/edit
2. Ride history compact display
3. CSV import row validation and history surfacing

Notes are optional plain text with a 500-character maximum.

## Prerequisites

- DevContainer running
- App launch command: `dotnet run --project src/BikeTracking.AppHost`
- Follow strict TDD gate: write failing tests first, run and confirm red with user before implementation

## Implementation Order

### Step 1: Contracts first

Update backend and frontend contract/types before service logic.

```text
src/BikeTracking.Api/Contracts/RidesContracts.cs
src/BikeTracking.Api/Contracts/ImportContracts.cs
src/BikeTracking.Frontend/src/services/ridesService.ts
```

### Step 2: Persistence and projection wiring

Add note persistence to rides and map note into history rows.

```text
src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs
src/BikeTracking.Api/Infrastructure/Persistence/Migrations/{timestamp}_AddRideNotes.cs
src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
```

### Step 3: Manual record/edit handling

Thread notes through record and edit write paths.

```text
src/BikeTracking.Api/Application/Rides/RecordRideService.cs
src/BikeTracking.Api/Application/Rides/EditRideService.cs
src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs
```

### Step 4: Import validation behavior

Add row-level note length validation (`>500`) while keeping valid-row processing.

```text
src/BikeTracking.Api/Application/Imports/CsvValidationRules.cs
src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs
```

### Step 5: Frontend note UX

Add note input to record page and compact indicator overlay behavior to history page.

```text
src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
src/BikeTracking.Frontend/src/pages/HistoryPage.css
src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx
```

## TDD-First Test Checklist

Write and run these failing tests first.

### Backend unit/integration

- Record ride accepts valid note (<=500) and persists it.
- Record ride rejects note over 500 with clear validation.
- Edit ride updates/clears note and keeps version behavior intact.
- History response includes note field for rides with notes.
- CSV row with note >500 is invalid with `NOTE_TOO_LONG` (row-level).
- Import still processes other valid rows when one row note is invalid.

### Frontend unit

- Record ride form renders note input and enforces max length behavior.
- History row shows note indicator only when note exists.
- Note reveal works for keyboard focus and touch tap interactions.
- Import preview shows note-length row error and still allows valid rows.

### E2E

- Rider records note and sees indicator/reveal in history.
- Rider edits note and sees updated text in history.
- Rider imports CSV with mixed valid and oversized notes; valid rows import, oversized rows flagged.

## Verification Commands

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
