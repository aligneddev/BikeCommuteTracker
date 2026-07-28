# Data Model: CSV Data Export

## Overview

This feature introduces no new database tables and no schema migrations. It is a read-only export over two existing entities: `ExpenseEntity` and `RideEntity`.

---

## Existing Entities Used

### ExpenseEntity (`Expenses` table)

| Column         | C# Type     | Nullable | Export Column Name | Notes                                          |
|----------------|-------------|----------|--------------------|------------------------------------------------|
| `Id`           | `long`      | No       | `ExpenseId`        | Primary key                                    |
| `RiderId`      | `long`      | No       | _(scoping only)_   | Used in WHERE clause; not exported             |
| `ExpenseDate`  | `DateTime`  | No       | `Date`             | Formatted as `yyyy-MM-dd`                      |
| `Amount`       | `decimal`   | No       | `Amount`           | Raw decimal, no currency symbol                |
| `Notes`        | `string?`   | Yes      | `Notes`            | Blank cell when null; quoted if contains comma |
| `IsDeleted`    | `bool`      | No       | _(filter only)_    | WHERE `IsDeleted = false`; never exported      |
| `CreatedAtUtc` | `DateTime`  | No       | `CreatedAtUtc`     | Formatted as ISO 8601 (`yyyy-MM-ddTHH:mm:ssZ`) |

**Export filter**: `WHERE RiderId = @riderId AND IsDeleted = false ORDER BY ExpenseDate DESC`

**CSV column order**: `ExpenseId`, `Date`, `Amount`, `Notes`, `CreatedAtUtc`

---

### RideEntity (`Rides` table)

| Column                    | C# Type    | Nullable | Export Column Name        | Notes                                           |
|---------------------------|------------|----------|---------------------------|-------------------------------------------------|
| `Id`                      | `int`      | No       | `RideId`                  | Primary key                                     |
| `RiderId`                 | `long`     | No       | _(scoping only)_          | Used in WHERE clause; not exported              |
| `RideDateTimeLocal`       | `DateTime` | No       | `Date`                    | Formatted as `yyyy-MM-ddTHH:mm:ss` (local time) |
| `Miles`                   | `decimal`  | No       | `Miles`                   | Raw decimal                                     |
| `RideMinutes`             | `int?`     | Yes      | `RideMinutes`             | Blank when null                                 |
| `Temperature`             | `decimal?` | Yes      | `Temperature`             | Blank when null; Fahrenheit                     |
| `GasPricePerGallon`       | `decimal?` | Yes      | `GasPricePerGallon`       | Blank when null                                 |
| `WindSpeedMph`            | `decimal?` | Yes      | `WindSpeedMph`            | Blank when null                                 |
| `WindDirectionDeg`        | `int?`     | Yes      | `WindDirectionDeg`        | Blank when null                                 |
| `RelativeHumidityPercent` | `int?`     | Yes      | `RelativeHumidityPercent` | Blank when null                                 |
| `CloudCoverPercent`       | `int?`     | Yes      | `CloudCoverPercent`       | Blank when null                                 |
| `PrecipitationType`       | `string?`  | Yes      | `PrecipitationType`       | Blank when null; quoted if contains comma       |
| `Notes`                   | `string?`  | Yes      | `Note`                    | Blank when null; quoted if contains comma/quote |
| `WeatherUserOverridden`   | `bool`     | No       | `WeatherUserOverridden`   | Exported as `true`/`false`                      |
| `Difficulty`              | `int?`     | Yes      | `Difficulty`              | Blank when null; 1–5                            |
| `PrimaryTravelDirection`  | `string?`  | Yes      | `PrimaryTravelDirection`  | Blank when null; quoted if contains comma       |
| `WindResistanceRating`    | `int?`     | Yes      | `WindResistanceRating`    | Blank when null; −4 to +4                       |
| `ImportSource`            | `string?`  | Yes      | `ImportSource`            | Blank when null                                 |
| `SnapshotAverageCarMpg`   | `decimal?` | Yes      | `SnapshotAverageCarMpg`   | Blank when null; captured from settings at ride time |
| `SnapshotMileageRateCents`| `decimal?` | Yes      | `SnapshotMileageRateCents`| Blank when null; captured from settings at ride time |
| `SnapshotYearlyGoalMiles` | `decimal?` | Yes      | `SnapshotYearlyGoalMiles` | Blank when null; captured from settings at ride time |
| `SnapshotOilChangePrice`  | `decimal?` | Yes      | `SnapshotOilChangePrice`  | Blank when null; captured from settings at ride time |
| `CreatedAtUtc`            | `DateTime` | No       | `CreatedAtUtc`            | Formatted as ISO 8601 (`yyyy-MM-ddTHH:mm:ssZ`) |

**Export filter**: `WHERE RiderId = @riderId ORDER BY RideDateTimeLocal DESC`

**Grouping for ZIP**: Rides are grouped by `RideDateTimeLocal.Year`. Each year produces one `{year}.csv` entry inside the ZIP.

**CSV column order**: `RideId`, `Date`, `Miles`, `RideMinutes`, `Temperature`, `GasPricePerGallon`, `WindSpeedMph`, `WindDirectionDeg`, `RelativeHumidityPercent`, `CloudCoverPercent`, `PrecipitationType`, `Note`, `WeatherUserOverridden`, `Difficulty`, `PrimaryTravelDirection`, `WindResistanceRating`, `ImportSource`, `SnapshotAverageCarMpg`, `SnapshotMileageRateCents`, `SnapshotYearlyGoalMiles`, `SnapshotOilChangePrice`, `CreatedAtUtc`

---

## CsvRowBuilder (Utility)

A shared in-project helper in `Application/Export/CsvRowBuilder.cs`. No new NuGet dependency.

**Responsibility**: Produce a single RFC 4180-compliant CSV row string from a sequence of field values.

**Quoting rules**:
- A field is quoted if it contains `,`, `"`, `\r`, or `\n`.
- An embedded `"` is escaped as `""`.
- Null fields are rendered as empty string (no quotes).
- Boolean fields are rendered as `true` or `false`.
- DateTime fields are formatted by the caller before passing in.

**Interface**:
```csharp
// Application/Export/CsvRowBuilder.cs
public static class CsvRowBuilder
{
    public static string BuildRow(IEnumerable<string?> fields);
    public static string BuildHeader(IEnumerable<string> columnNames);
}
```

---

## ZIP Structure

```
ride-history-export.zip
├── 2024.csv
├── 2025.csv
└── 2026.csv
```

Each per-year CSV begins with the standard ride header row, followed by one data row per ride for that year ordered by `RideDateTimeLocal` descending. If a user has no rides, the ZIP contains a single `{currentYear}.csv` with only the header row (see Assumption in spec).
