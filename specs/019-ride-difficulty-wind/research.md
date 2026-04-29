# Research: Ride Difficulty & Wind Resistance Rating

**Feature**: `019-ride-difficulty-wind`  
**Phase**: 0 — Outline & Research  
**Date**: 2026-04-24  

All unknowns from the Technical Context have been resolved. This document records the decision, rationale, and alternatives for each investigation area.

---

## Decision 1 — Wind Direction Convention (meteorological vs. geographic)

**Decision**: Use **meteorological convention** throughout — wind direction (degrees 0–360) means the compass bearing the wind is blowing **FROM**, not towards. `0°` = wind blowing FROM the north.

**Rationale**:
- Open-Meteo (the weather API used since spec 011) returns `wind_direction_10m` in meteorological degrees (wind FROM bearing). Existing field `WindDirectionDeg` on `RideEntity` is already stored in this convention.
- Meteorological convention is the standard in all wind atlases, cycling apps, and weather tooling. Using geographic convention (wind-towards) would require silently inverting all stored weather data.

**Alternatives considered**:
- Geographic ("wind-towards"): Rejected — contradicts stored data semantics; would introduce hidden inversion bug.
- Storing as 8-point compass name: Rejected — loss of precision for future 16-point or degree-level analysis. The API stores degrees; conversion to compass points happens at domain-logic boundary.

---

## Decision 2 — Degree-to-8-Point-Compass Mapping

**Decision**: Map 0–360° to an 8-point compass using **22.5° bin boundaries**, centered on each cardinal/intercardinal point. Formula: `sector = floor((degrees + 22) % 360 / 45)`.

| Degrees | Compass | Center |
|---------|---------|--------|
| 337.5° – 22.5° | North | 0° |
| 22.5° – 67.5° | NE | 45° |
| 67.5° – 112.5° | East | 90° |
| 112.5° – 157.5° | SE | 135° |
| 157.5° – 202.5° | South | 180° |
| 202.5° – 247.5° | SW | 225° |
| 247.5° – 292.5° | West | 270° |
| 292.5° – 337.5° | NW | 315° |

**Rationale**: 45° equal sectors are the WMO standard for 8-point compass mapping; placing boundaries at midpoints minimises directional ambiguity. The `+22` offset before modulo handles the wrap-around at north (0°/360°).

**Alternatives considered**:
- 16-point compass: Rejected — spec explicitly uses 8-point direction names; adds UI/UX complexity for negligible precision gain given the formula's rounding to integer ratings.
- Nearest-integer truncation without offset: Rejected — misclassifies 350° as `NW` instead of `North`.

---

## Decision 3 — Wind Resistance Formula

**Decision**: Use the cosine-based formula specified in the feature spec:

```
rawResistance = windSpeedMph × cos(angleBetweenDirections) / 5.0
resistance    = clamp(round(rawResistance, AwayFromZero), −4, +4)
```

Where `angleBetweenDirections` is the **shorter arc** (0–180°) between the rider's travel direction (degrees) and the wind-FROM bearing (degrees).

**Sign convention confirmed**:
| Scenario | Angle | cos | Resistance | Meaning |
|----------|-------|-----|-----------|---------|
| Direct headwind (travel North, wind FROM North) | 0° | +1.0 | +4 | Hardest |
| Crosswind (travel North, wind FROM East) | 90° | 0.0 | 0 | Neutral |
| Direct tailwind (travel North, wind FROM South) | 180° | −1.0 | −4 | Easiest |
| 20 mph direct headwind (spec target) | 0° | +1.0 | `round(20×1/5)` = 4 | ✅ matches spec |

**Rationale**:
- Formula is directly specified in spec Assumptions section. This decision validates and confirms correctness.
- `MidpointRounding.AwayFromZero` aligns with the precedent set in `AdvancedDashboardCalculations.fs`.
- Shorter-arc semantics ensures a 190° difference is treated as a 170° difference from the other side — physically correct, since the closer the wind source to your travel direction (front half), the greater the headwind component.

**Alternatives considered**:
- Sine-based formula: Rejected — `sin(0°)=0` would produce zero resistance for a direct headwind; opposite of physical reality.
- Linear step function by compass sectors (e.g., headwind=+4, crosswind=0, tailwind=−4): Rejected — loses the intermediate wind speed scaling; 3 mph crosswind should differ from 20 mph crosswind.

---

## Decision 4 — Special Case: Zero Wind Speed

**Decision**: When `windSpeedMph` is `null` or `0`, skip the formula entirely and return `(windResistanceRating = 0, suggestedDifficulty = 1)`.

**Rationale**: FR-012 explicitly specifies this rule. Zero wind means no resistance component; difficulty 1 (Very Easy) is the correct interpretation — the rider is not fighting wind at all. The formula would also produce `0` for zero speed, but returning difficulty `3` (neutral mapping of 0) would be misleading when wind is simply absent.

**Alternatives considered**:
- Apply formula → resistance 0 → difficulty 3 (Moderate): Rejected — contradicts FR-012 and user expectation; calm weather should not suggest "moderate" difficulty.

---

## Decision 5 — Difficulty Mapping (Wind Resistance → 1–5 Scale)

**Decision**: Use this lookup table:

| Wind Resistance | Difficulty | Label |
|-----------------|------------|-------|
| ≤ −3 (i.e., −3 or −4) | 1 | Very Easy |
| −2 or −1 | 2 | Easy |
| 0 | 3 | Moderate |
| +1 or +2 | 4 | Hard |
| ≥ +3 (i.e., +3 or +4) | 5 | Very Hard |

**F# match expression**:
```fsharp
let resistanceToDifficulty (r: int) : int =
    if r <= -3 then 1
    elif r = -2 || r = -1 then 2
    elif r = 0 then 3
    elif r = 1 || r = 2 then 4
    else 5
```

**Rationale**:
- Spec FR-011: "strong tailwind biases toward 1–2, neutral toward 3, strong headwind toward 4–5." This mapping satisfies that exactly.
- Symmetric bin sizes around 0: bins −3/−4 and +3/+4 are each size 2 (matching the 1-and-5 extremes), bins −1/−2 and +1/+2 are size 2 (matching 2 and 4), and 0 maps to 3.
- Zero wind (special case, Decision 4) returns 1, not 3 — the two rules are consistent but must be checked in order: zero-speed check fires first.

**Alternatives considered**:
- Linear formula `round(resistance/2 + 3)`: Produces fractional difficulties for odd resistances; requires an additional round; less readable in F# match.
- 3-bucket mapping (1–2, 3, 4–5): Too coarse; loses resolution for moderate winds.

---

## Decision 6 — Client-Side Suggestion vs. Server Round-Trip

**Decision**: Mirror the wind resistance formula in TypeScript (`src/utils/windResistance.ts`) for the **client-side suggestion** (pre-fill on direction-change). The server-side F# function remains authoritative for persistence at save time.

**Rationale**:
- SC-002 requires the auto-fill within 1 second of direction selection. A round-trip API call adds latency and complexity for a non-authoritative suggestion.
- The formula is deterministic and small — five lines of arithmetic. Duplicating it in TypeScript is low risk and directly mirrors the F# module (same lookup table, same rounding).
- The persisted value (written via F# domain layer) is what matters for analytics; the TypeScript value is display-only and will be overwritten on save with the authoritative server result.
- Constitution does not prohibit mirroring pure formulas in the frontend; it prohibits domain *logic* (state machines, validation rules) from living only in the frontend.

**Alternatives considered**:
- New `GET /api/rides/wind-resistance-suggestion` endpoint: Rejected — adds latency, a new endpoint, and extra test surface for a display-only suggestion that is immediately replaced on save.
- Calculate only server-side, show suggestion after save: Rejected — contradicts FR-004 (must auto-populate before saving).

---

## Decision 7 — Dashboard Difficulty Derivation Chain

**Decision**: For dashboard difficulty calculations, follow this priority chain (spec FR-022):

1. **Stored `Difficulty`** on the ride: use as-is (rider's authoritative rating).
2. **Stored `WindResistanceRating`** on the ride (not null, `Difficulty` is null): map through `resistanceToDifficulty()`.
3. **Neither stored**: derive from raw `WindSpeedMph` + `WindDirectionDeg` + `PrimaryTravelDirection` if all three are present.
4. **Insufficient data**: exclude ride from difficulty aggregations.

**Rationale**: Minimises recomputation. The vast majority of rides will have `WindResistanceRating` after this feature ships; the raw re-derivation is only needed for rides with direction data but no persisted resistance value (edge case for historical data). The chain ensures no double-counting and no silent zeros.

**Alternatives considered**:
- Always recompute from raw data: Rejected — ignores the rider's manual difficulty override; contradicts spec FR-019/FR-022.
- Only use stored `Difficulty`: Rejected — many rides will have direction+wind but no manually set difficulty; they would be excluded from analytics.

---

## Decision 8 — Calendar-Month Aggregation for Dashboard

**Decision**: Group rides by **calendar month number** (1=January … 12=December), averaging across all years. Produce exactly 12 possible groups, one per named month. A month is omitted from the ranking if it has zero qualifying rides.

**Rationale**: Spec Assumption and Clarification (2026-04-24): "all Januaries averaged together regardless of year." This is also consistent with the existing Advanced Dashboard which already uses calendar-based windows. 12 groups fit neatly in a horizontal bar chart without scrolling.

**Alternatives considered**:
- Year-month grouping (e.g., "Jan 2025", "Feb 2025"): Rejected per clarification. Produces too many groups for small datasets and contradicts spec.
- Rolling 30-day windows: Rejected per clarification.

---

## Decision 9 — EF Core Migration & Column Constraints

**Decision**: Single new migration `YYYYMMDD_AddRideDifficultyAndWindRating` with:

```sql
ALTER TABLE Rides ADD COLUMN Difficulty INTEGER NULL;
ALTER TABLE Rides ADD COLUMN PrimaryTravelDirection TEXT NULL;
ALTER TABLE Rides ADD COLUMN WindResistanceRating INTEGER NULL;
```

SQLite `CHECK` constraints for valid ranges are added via `HasCheckConstraint()` in the `OnModelCreating` override. Per existing SQLite compatibility workaround (`SqliteMigrationBootstrapper`), if any generated CHECK constraint SQL is unsupported by the SQLite provider, the migration ID must be added to `UnsupportedConstraintMigrations` so startup skips re-applying it while still marking it applied.

Column max lengths: `PrimaryTravelDirection` — max 5 chars (`TEXT` in SQLite, `NVARCHAR(5)` in schema snapshot).

**Rationale**: Three separate nullable columns on `RideEntity` follow the existing pattern. No separate lookup table is needed — both `Difficulty` and `WindResistanceRating` are scalar computed values stored as integers. `PrimaryTravelDirection` is a short string enum value; storing as text (not int) makes the database readable and debuggable without a lookup table.

**Alternatives considered**:
- Separate `RideDifficulty` table: Rejected — adds a join for every ride read; no separate lifecycle; spec says "persisted on the Ride record."
- Store compass direction as integer (0–7): Rejected — reduces debuggability; the text representation ("North", "NE") is already short.

---

## Decision 10 — F# Module Placement & Naming

**Decision**: Create `BikeTracking.Domain.FSharp/WindResistance.fs` as a new F# module alongside `AdvancedDashboardCalculations.fs`. Module namespace: `BikeTracking.Domain.FSharp.WindResistance`. Add it before `AdvancedDashboardCalculations.fs` in the `.fsproj` compile order.

**Rationale**: Follows existing module naming pattern (`module BikeTracking.Domain.FSharp.AdvancedDashboardCalculations`). Keeps wind resistance logic separate from savings calculations. The module exports pure functions only — no `open System.IO`, no EF types, no HTTP clients.

**Alternatives considered**:
- Adding to `AdvancedDashboardCalculations.fs`: Rejected — different concern; makes the file unwieldy; harder to test in isolation.
- New sub-folder `Rides/WindResistance.fs`: Rejected — existing domain files are all at root level of the F# project; sub-folders not yet established.

---

## Decision 11 — CSV Import Column Validation

**Decision**: Add `Difficulty` and `Direction` validation to `CsvValidationRules.ValidateRow()` following the existing error-per-row pattern:

- `Difficulty`: Optional. If present, must parse as integer in [1, 5]. Error code `INVALID_DIFFICULTY`.
- `Direction`: Optional. If present, must be one of the 8 accepted values (case-insensitive on parse, stored as canonical casing). Error code `INVALID_DIRECTION`.
- Both absent: row accepted without error (FR-018).

**Sample CSV generation**: New `SampleCsvGenerator` class produces an in-memory CSV string with a legend row and one realistic example row. Served via `GET /api/rides/csv-sample` (no auth required beyond login). Content-Disposition header triggers browser download.

**Rationale**: Matches existing `INVALID_DATE`, `INVALID_MILES` error pattern. Case-insensitive parse (e.g., "north" → "North") reduces import friction without compromising validation.

**Alternatives considered**:
- Strict case-sensitive matching: Rejected — users editing CSVs in Excel/Numbers frequently produce lowercase values; high friction for negligible benefit.
- Hard-coding sample CSV as embedded resource: Rejected — sample CSV must reflect the current column set; a generator keeps it in sync with code changes.

---

## All Unknowns Resolved

| Unknown | Resolution |
|---------|-----------|
| Wind direction convention | Meteorological (FROM), matches Open-Meteo stored data |
| Formula validation | Cosine-based confirmed; sign convention verified |
| Degree → compass mapping | 22.5° bin boundaries, 8-point |
| Difficulty lookup table | −3/−4→1, −1/−2→2, 0→3, +1/+2→4, +3/+4→5 |
| Zero-speed edge case | Return (0, 1) before formula; FR-012 rule |
| Auto-suggest architecture | TypeScript mirror for instant UX; F# authoritative at save |
| Dashboard derivation | 3-step chain: stored difficulty → stored rating → raw recompute |
| Monthly aggregation | Calendar month 1–12, all years combined, max 12 groups |
| DB schema | 3 nullable columns on Rides table, 1 migration |
| F# module location | `WindResistance.fs` alongside existing domain files |
| CSV validation | `INVALID_DIFFICULTY` + `INVALID_DIRECTION` error codes |
