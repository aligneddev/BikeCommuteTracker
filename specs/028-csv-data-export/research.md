# Research: CSV Data Export

## Decision 1 — CSV Generation Strategy

**Decision**: Implement a lightweight `CsvRowBuilder` helper class in `Application/Export/` using manual RFC 4180 quoting (wrap in double-quotes when value contains comma, double-quote, or newline; escape embedded double-quotes by doubling them).

**Rationale**: The project already has a hand-rolled `CsvExpenseParser` and `SampleCsvGenerator` using `StringBuilder` — this establishes a precedent for manual CSV handling. Adding `CsvHelper` (a third-party NuGet package) for write-only export would introduce a dependency heavier than the problem warrants. A 20-line `CsvRowBuilder` covers RFC 4180 requirements completely and keeps the dependency surface flat.

**Alternatives considered**:
- `CsvHelper` NuGet package — well-established library; rejected because it introduces a new dependency for simple write-only logic that an in-project utility handles cleanly.
- `StringBuilder` ad-hoc per service — rejected because duplicated quoting logic across two services invites divergence; a shared helper keeps it DRY.

---

## Decision 2 — ZIP Creation

**Decision**: Use `System.IO.Compression.ZipArchive` (built-in .NET BCL) to assemble the ride history ZIP in memory via a `MemoryStream`. Write one `ZipArchiveEntry` per year named `{year}.csv`, then return the stream as the response body.

**Rationale**: `System.IO.Compression` is part of the .NET BCL — zero new dependencies. The target dataset (5,000 rides across 10 years) generates at most ~10 CSV files totalling a few hundred KB; in-memory assembly is safe and avoids temp-file cleanup concerns.

**Alternatives considered**:
- Temp-file on disk — rejected; adds file I/O, temp-path management, and cleanup complexity.
- Third-party ZIP libraries (SharpZipLib, ZipFile.CreateFromDirectory) — rejected; BCL covers the requirement fully.

---

## Decision 3 — API Endpoint Placement

**Decision**: New `ExportEndpoints` class mapping a `/api/exports` route group with two GET endpoints: `GET /api/exports/expenses` and `GET /api/exports/rides`.

**Rationale**: Grouping export endpoints under `/api/exports` mirrors how the existing codebase organises feature-scoped endpoints (`/api/rides`, `/api/expenses`, `/api/imports`). A dedicated group keeps export concerns isolated and avoids polluting the rides or expenses groups with binary-download endpoints.

**Alternatives considered**:
- Add `GET /api/expenses/export` inside `ExpensesEndpoints` — rejected; mixes record-mutation and bulk-export concerns in the same class.
- Single polymorph endpoint `GET /api/exports?type=expenses|rides` — rejected; a query parameter switch makes route documentation and Swagger descriptions less clear than two explicit routes.

---

## Decision 4 — Export Column Set

**Decision**: Export columns are sourced directly from `RideEntity` / `ExpenseEntity`. `HasReceipt` is omitted from expenses export (the spec says "raw field values"; receipt presence is metadata about attachments, not a stored expense attribute). The `IsDeleted` soft-delete flag is filtered out server-side and never exported. `CreatedAtUtc` is read directly from the entity, not from the existing `RideHistoryRow` or `ExpenseHistoryRow` response contracts (those DTOs omit `CreatedAtUtc`); the export service queries the entity directly.

**Expense CSV columns**: `ExpenseId`, `Date`, `Amount`, `Notes`, `CreatedAtUtc`

**Ride CSV columns**: `RideId`, `Date`, `Miles`, `RideMinutes`, `Temperature`, `GasPricePerGallon`, `WindSpeedMph`, `WindDirectionDeg`, `RelativeHumidityPercent`, `CloudCoverPercent`, `PrecipitationType`, `Note`, `WeatherUserOverridden`, `Difficulty`, `PrimaryTravelDirection`, `WindResistanceRating`, `ImportSource`, `SnapshotAverageCarMpg`, `SnapshotMileageRateCents`, `SnapshotYearlyGoalMiles`, `SnapshotOilChangePrice`, `CreatedAtUtc`

**Rationale**: The spec explicitly states the column set mirrors existing data models. `HasReceipt` is a computed derived flag from `ReceiptPath`, not a stored field — omitting it keeps exports clean. `IsDeleted` is a soft-delete mechanism; records where `IsDeleted = true` are already excluded from all other read operations.

**Alternatives considered**:
- Include all `ExpenseEntity` fields including `ReceiptPath` — rejected; filesystem path is an internal implementation detail inappropriate for user exports.
- Include `HasReceipt` — rejected; same reason — it is derived metadata, not raw stored data.

---

## Decision 5 — Frontend Download Mechanism

**Decision**: Trigger downloads via the Fetch API, receive the binary response as a `Blob`, create an object URL, inject a transient `<a>` element with the `download` attribute, click it programmatically, then revoke the URL. This mirrors the existing `downloadExpenseReceipt` pattern already in `expenses-api.ts`.

**Rationale**: Consistent with how receipt downloads already work in the codebase. The blob approach handles both the CSV and ZIP without any additional libraries. The `Content-Disposition: attachment; filename="..."` header from the API provides the suggested filename.

**Alternatives considered**:
- Direct `window.location.href` navigation — rejected; does not work reliably with authenticated requests (no way to pass `X-User-Id` header).
- Anchor tag with `href` pointing to API URL and auth via query param — rejected; the session uses a header-based auth scheme; leaking user ID in the URL query string is undesirable.
