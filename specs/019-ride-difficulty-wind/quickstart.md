# Quickstart: Ride Difficulty & Wind Resistance Rating

**Feature**: `019-ride-difficulty-wind`  
**Branch**: `019-ride-difficulty-wind`  
**Date**: 2026-04-24

This guide walks a developer through implementing the full feature end-to-end, in dependency order.

---

## Prerequisites

- Working in the DevContainer (mandatory per constitution)
- `main` branch compiles and all tests pass: `dotnet test`
- Node modules installed: `cd src/BikeTracking.Frontend && npm install`
- Feature branch checked out: `git checkout 019-ride-difficulty-wind`

---

## Step 1 — F# Domain Module (WindResistance.fs)

**Why first**: Every other layer depends on this pure calculation. Tests validate the formula before any persistence or API work.

1. Create `src/BikeTracking.Domain.FSharp/WindResistance.fs` using the module spec from `data-model.md §2.1`.
2. Add it to `BikeTracking.Domain.FSharp.fsproj` before `AdvancedDashboardCalculations.fs`.
3. Write unit tests in `BikeTracking.Api.Tests/Application/Rides/WindResistanceCalculationTests.cs`:
   - `degreesToCompass`: boundary cases (0°, 22°, 23°, 45°, 337°, 360°).
   - `calculateResistance`: 20 mph headwind = +4; 20 mph tailwind = −4; crosswind = 0; clamp at 4/-4; negative speed → Error.
   - `calculateDifficulty`: wind=0 → (0, 1); no wind data → (0, 1); full headwind = (4, 5); full tailwind = (−4, 1).
   - `resistanceToDifficulty`: all 9 input values (−4 to +4).
4. Build: `dotnet build src/BikeTracking.Domain.FSharp/`
5. Run tests: `dotnet test --filter "WindResistanceCalculation"`

**TDD gate**: Commit red baseline, confirm failures, implement, commit green.

---

## Step 2 — Database Migration

**Why second**: Entity and migration must exist before service layer changes.

1. Add three nullable properties to `RideEntity` (see `data-model.md §1.1`):
   - `int? Difficulty`
   - `string? PrimaryTravelDirection`
   - `int? WindResistanceRating`

2. Add EF Core model configuration in `BikeTrackingDbContext.OnModelCreating` for `Rides`:

   ```csharp
   modelBuilder.Entity<RideEntity>()
       .Property(r => r.PrimaryTravelDirection)
       .HasMaxLength(5);

   modelBuilder.Entity<RideEntity>()
       .HasCheckConstraint(
           "CK_Rides_Difficulty",
           "Difficulty IS NULL OR (Difficulty >= 1 AND Difficulty <= 5)");

   modelBuilder.Entity<RideEntity>()
       .HasCheckConstraint(
           "CK_Rides_WindResistanceRating",
           "WindResistanceRating IS NULL OR (WindResistanceRating >= -4 AND WindResistanceRating <= 4)");
   ```

3. Generate migration from DevContainer terminal:

   ```bash
   cd src/BikeTracking.Api
   dotnet ef migrations add AddRideDifficultyAndWindRating \
     --project ../BikeTracking.Api \
     --output-dir Infrastructure/Persistence/Migrations
   ```

4. Verify generated SQL includes the three `ADD COLUMN` statements.

5. If CHECK constraint SQL is unsupported (see `SqliteMigrationBootstrapper`), add the new migration ID to `UnsupportedConstraintMigrations`.

6. Run migration manually to verify: `dotnet run --project src/BikeTracking.Api` and check startup logs for "Applying migrations…".

7. Write `RidesPersistenceTests.cs` tests:
   - Difficulty saved and retrieved correctly.
   - WindResistanceRating saved and retrieved correctly.
   - `PrimaryTravelDirection` saved and retrieved; max-length constraint.

---

## Step 3 — RecordRideService (Compute at Save)

1. Update `RecordRideRequest` in `RidesContracts.cs` to add `int? Difficulty` and `string? PrimaryTravelDirection` (see `contracts/rides-api.md §1`).

2. Update `RecordRideService.ExecuteAsync`:

   ```csharp
   // After weather merge, before entity creation:
   int? windResistanceRating = null;
   if (request.PrimaryTravelDirection is not null
       && windSpeedMph.HasValue
       && windDirectionDeg.HasValue)
   {
       var directionResult = WindResistance.tryParseCompassDirection(request.PrimaryTravelDirection);
       if (directionResult is FSharpOption<CompassDirection>.Some dir)
       {
           var result = WindResistance.calculateDifficulty(
               FSharpOption<decimal>.Some(windSpeedMph.Value),
               dir.Value,
               FSharpOption<int>.Some(windDirectionDeg.Value));
           if (result.IsOk) windResistanceRating = result.ResultValue.Item1;
       }
   }

   // Assign to entity:
   rideEntity.Difficulty = request.Difficulty;
   rideEntity.PrimaryTravelDirection = request.PrimaryTravelDirection;
   rideEntity.WindResistanceRating = windResistanceRating;
   ```

3. Update `RideRecordedEventPayload` to include the three new fields (see `contracts/rides-api.md §7`).

4. Write tests: `RecordRideWithDifficultyTests.cs`
   - Record ride with direction + wind → WindResistanceRating computed and persisted.
   - Record ride without direction → WindResistanceRating null.
   - Record ride with wind speed 0 → WindResistanceRating 0 and Difficulty stored if provided.

---

## Step 4 — EditRideService (Recompute on Direction Change)

1. Update `EditRideRequest` in `RidesContracts.cs` to add `int? Difficulty` and `string? PrimaryTravelDirection`.

2. Extend `EditRideService.ExecuteAsync` to:
   - Compare incoming `PrimaryTravelDirection` with `ride.PrimaryTravelDirection`.
   - If direction changed or cleared, recompute `WindResistanceRating`.
   - Always store `request.Difficulty` as the rider's final choice (no silent override).
   - If direction is cleared (`null`), set `WindResistanceRating = null`.

3. Update `RideEditedEventPayload` with new fields.

4. Update `RideHistoryRow` response to include all three new fields.

5. Write tests: `EditRideWithDifficultyTests.cs`
   - Direction unchanged → WindResistanceRating unchanged.
   - Direction changed → WindResistanceRating recomputed.
   - Direction cleared → WindResistanceRating set to null.
   - Difficulty in request stored as-is (no server-side override).

---

## Step 5 — CSV Import Extension

1. Extend `ParsedCsvRow` with `string? Difficulty` and `string? Direction` (see `contracts/csv-import-format.md §3`).

2. Update `CsvParser` to map `difficulty` and `direction` header columns (case-insensitive) to the new row properties.

3. Update `CsvValidationRules.ValidateRow` with `INVALID_DIFFICULTY` and `INVALID_DIRECTION` rules.

4. Update `ImportJobProcessor` to:
   - Parse and store `Difficulty` from CSV row.
   - Parse `Direction`, canonicalise casing via `WindResistance.tryParseCompassDirection`.
   - Compute `WindResistanceRating` when Direction + WindSpeed available.

5. Create `SampleCsvGenerator` (see `contracts/csv-import-format.md §5`).

6. Register `GET /api/rides/csv-sample` endpoint in `RidesEndpoints.cs`.

7. Write import tests:
   - Valid `Difficulty` values (1–5) imported correctly.
   - `Difficulty` value 0 or 6 → `INVALID_DIFFICULTY` error.
   - Valid `Direction` values (all 8, case-insensitive) imported correctly.
   - "Northeast" → `INVALID_DIRECTION` error (listing valid values).
   - Absent `Difficulty` + `Direction` columns → no error.
   - Sample CSV download returns correct headers and content.

---

## Step 6 — Advanced Dashboard (Difficulty Analytics)

1. Add new record types to `DashboardContracts.cs`: `AdvancedDashboardDifficultySection`, `DifficultyByMonth`, `WindResistanceBin` (see `contracts/dashboard-api.md §2`).

2. Extend `AdvancedDashboardResponse` with nullable `DifficultySection` property.

3. Add F# dashboard calculation functions to `AdvancedDashboardCalculations.fs` (or new `DifficultyCalculations.fs`): `resolveDifficulty`, `calculateDifficultyByMonth`, `calculateOverallAverageDifficulty`, `calculateWindResistanceDistribution` (see `data-model.md §3.2`).

4. Extend `GetAdvancedDashboardService.GetAsync`:
   - Project rides to `RideDifficultySnapshot` list.
   - Call F# calculation functions.
   - Build `AdvancedDashboardDifficultySection` from results.
   - Set `IsEmpty = true` and return empty section when no qualifying data.

5. Write tests: `DifficultyAnalyticsTests.cs`
   - Overall average of rides with stored difficulty.
   - Monthly grouping: rides in Jan across multiple years average together.
   - `MostDifficultMonths` sorted descending.
   - FR-022 derivation chain: stored difficulty → stored rating → raw recompute.
   - Empty state when no wind data and no difficulty.
   - Wind resistance distribution: counts per bin.

---

## Step 7 — Frontend: Record Ride Form

**File**: `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`

1. Create `src/BikeTracking.Frontend/src/utils/windResistance.ts` with the TypeScript formula mirror (see `data-model.md §6.2`).

2. Add state variables to `RecordRidePage`:

   ```tsx
   const [difficulty, setDifficulty] = useState<number | "">("");
   const [primaryTravelDirection, setPrimaryTravelDirection] =
     useState<CompassDirection | "">("");
   const [isDifficultyAutoFilled, setIsDifficultyAutoFilled] = useState(false);
   ```

3. Add `useEffect` for auto-suggestion when direction or wind speed changes:

   ```tsx
   useEffect(() => {
     if (!primaryTravelDirection) return;
     const windMph = windSpeedMph ? parseFloat(windSpeedMph) : undefined;
     const windDeg = windDirectionDeg ? parseInt(windDirectionDeg) : undefined;
     const suggested = suggestDifficulty(windMph, primaryTravelDirection, windDeg);
     if (suggested !== null) {
       setDifficulty(suggested);
       setIsDifficultyAutoFilled(true);
     }
   }, [primaryTravelDirection, windSpeedMph, windDirectionDeg]);
   ```

4. Add form fields:
   - `PrimaryTravelDirection` `<select>` with 8 compass options + empty option. Include info icon with tooltip explaining the field (FR-003).
   - `Difficulty` `<select>` with options 1–5 (labelled Very Easy … Very Hard) + empty option. Show "(suggested)" label when `isDifficultyAutoFilled` is true.
   - When rider manually changes `Difficulty`, set `isDifficultyAutoFilled = false`.
   - When rider clears `PrimaryTravelDirection`, clear the suggested `Difficulty` (if it was auto-filled) and reset `isDifficultyAutoFilled`.

5. Include new fields in the submit payload:
   ```tsx
   difficulty: difficulty !== "" ? difficulty : undefined,
   primaryTravelDirection: primaryTravelDirection !== "" ? primaryTravelDirection : undefined,
   ```

6. Validate in submit handler: if `difficulty !== ""`, ensure it is 1–5.

7. Styling: use CSS classes only (no inline styles). Add classes to `RecordRidePage.css` (or the appropriate CSS module).

---

## Step 8 — Frontend: Edit Ride Form

If an edit ride form exists (separate component or inline), apply the same direction + difficulty fields as Step 7.

Key differences from record flow:
- Pre-populate direction and difficulty from the ride's stored values (from history row).
- When direction changes, re-suggest difficulty but mark as suggestion (not authoritative) — FR-027.
- Send `difficulty` and `primaryTravelDirection` in `EditRideRequest`.

---

## Step 9 — Frontend: Advanced Dashboard Difficulty Section

**New file**: `src/BikeTracking.Frontend/src/pages/advanced-dashboard/DifficultyAnalyticsSection.tsx`

```tsx
interface DifficultyAnalyticsSectionProps {
  section: AdvancedDashboardDifficultySection;
}

export function DifficultyAnalyticsSection({ section }: DifficultyAnalyticsSectionProps) {
  if (section.isEmpty) {
    return (
      <div className="difficulty-empty-state">
        <p>Record rides with travel direction to see difficulty trends.</p>
      </div>
    );
  }

  return (
    <section className="difficulty-analytics">
      <h2>Ride Difficulty</h2>
      {/* Overall average */}
      {/* Monthly bar chart using Recharts BarChart */}
      {/* Most difficult months ranked list */}
      {/* Wind resistance distribution chart — negative bars styled differently (FR-024) */}
    </section>
  );
}
```

**Charts**:
- Monthly difficulty: `BarChart` with month names on X-axis, `averageDifficulty` on Y-axis.
- Wind resistance distribution: `BarChart` with rating bins −4 to +4 on X-axis. Use different `fill` CSS class for `isAssisted: true` (tailwind) vs `false` (headwind) bars (FR-024).
- All chart colours via CSS custom properties / `ChartConfig` pattern (matches existing `dashboard-chart-section.tsx` pattern).

Extend `advanced-dashboard-page.tsx` to render `<DifficultyAnalyticsSection section={data.difficultySection} />` when `data.difficultySection` is not null.

---

## Step 10 — Frontend: History Page & Import Page

1. `HistoryPage.tsx`: Add `Difficulty` and `PrimaryTravelDirection` columns to the ride history table. `WindResistanceRating` can be shown as a small badge (e.g., "+3 headwind").

2. `ImportRidesPage.tsx`: No structural change — validation errors with `INVALID_DIFFICULTY` and `INVALID_DIRECTION` codes will display via the existing error rendering path.

---

## Verification Checklist

Before raising the PR, confirm:

- [ ] `dotnet build` — solution compiles with no warnings
- [ ] `dotnet test` — all existing tests still pass; new tests pass
- [ ] `npm run build` — frontend builds with no TypeScript errors (`strict: true`)
- [ ] Aspire host starts: `dotnet run --project src/BikeTracking.AppHost`
- [ ] Record ride with direction + wind → difficulty auto-fills within 1 second (SC-002)
- [ ] Save ride → `WindResistanceRating` in DB (verify via sqlite3 or test)
- [ ] Edit ride, change direction → `WindResistanceRating` recomputed at save
- [ ] CSV import with `Difficulty` and `Direction` columns → rows imported correctly
- [ ] Invalid `Difficulty` (6) → row rejected with `INVALID_DIFFICULTY` error
- [ ] Invalid `Direction` ("Northeast") → row rejected with `INVALID_DIRECTION` error
- [ ] `GET /api/rides/csv-sample` → downloads CSV with all columns
- [ ] Advanced Dashboard shows difficulty section with correct averages
- [ ] Wind resistance chart visually distinguishes negative (tailwind) bars

---

## Key File Locations Reference

| What | Where |
|------|-------|
| F# wind resistance module | `src/BikeTracking.Domain.FSharp/WindResistance.fs` |
| F# project file | `src/BikeTracking.Domain.FSharp/BikeTracking.Domain.FSharp.fsproj` |
| Ride entity | `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs` |
| Migration | `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/` |
| Record ride service | `src/BikeTracking.Api/Application/Rides/RecordRideService.cs` |
| Edit ride service | `src/BikeTracking.Api/Application/Rides/EditRideService.cs` |
| CSV validation | `src/BikeTracking.Api/Application/Imports/CsvValidationRules.cs` |
| CSV parser | `src/BikeTracking.Api/Application/Imports/CsvParser.cs` |
| Sample CSV generator | `src/BikeTracking.Api/Application/Imports/SampleCsvGenerator.cs` |
| Rides contracts | `src/BikeTracking.Api/Contracts/RidesContracts.cs` |
| Dashboard contracts | `src/BikeTracking.Api/Contracts/DashboardContracts.cs` |
| Advanced dashboard service | `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs` |
| Event payloads | `src/BikeTracking.Api/Application/Events/` |
| TS formula mirror | `src/BikeTracking.Frontend/src/utils/windResistance.ts` |
| Record ride page | `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx` |
| Advanced dashboard page | `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.tsx` |
| Difficulty analytics section | `src/BikeTracking.Frontend/src/pages/advanced-dashboard/DifficultyAnalyticsSection.tsx` |
| Frontend API types | `src/BikeTracking.Frontend/src/services/ridesService.ts` |
| Advanced dashboard API types | `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts` |
| Wind resistance tests | `src/BikeTracking.Api.Tests/Application/Rides/WindResistanceCalculationTests.cs` |
| Difficulty analytics tests | `src/BikeTracking.Api.Tests/Application/Dashboard/DifficultyAnalyticsTests.cs` |
