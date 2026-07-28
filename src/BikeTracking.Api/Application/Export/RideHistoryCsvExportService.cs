using System.IO.Compression;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Export;

/// <summary>
/// Reads all ride records for a rider and produces a ZIP archive containing
/// one RFC 4180-compliant CSV file per calendar year.
/// </summary>
/// <remarks>
/// Each per-year CSV filename: <c>{year}.csv</c><br/>
/// Export filter: WHERE RiderId = @riderId ORDER BY RideDateTimeLocal DESC<br/>
/// Grouping: rides grouped by <c>RideDateTimeLocal.Year</c><br/>
/// Empty dataset: returns a ZIP containing a single header-only CSV for the current year.
/// </remarks>
public sealed class RideHistoryCsvExportService(BikeTrackingDbContext db)
{
    private static readonly string[] Headers =
    [
        "RideId", "Date", "Miles", "RideMinutes", "Temperature", "GasPricePerGallon",
        "WindSpeedMph", "WindDirectionDeg", "RelativeHumidityPercent", "CloudCoverPercent",
        "PrecipitationType", "Note", "WeatherUserOverridden", "Difficulty",
        "PrimaryTravelDirection", "WindResistanceRating", "ImportSource",
        "SnapshotAverageCarMpg", "SnapshotMileageRateCents", "SnapshotYearlyGoalMiles",
        "SnapshotOilChangePrice", "CreatedAtUtc",
    ];

    /// <summary>
    /// Generates the ride history ZIP archive and returns a sealed <see cref="MemoryStream"/>.
    /// The caller is responsible for disposing the returned stream.
    /// </summary>
    public async Task<MemoryStream> ExportAsync(long riderId, CancellationToken cancellationToken = default)
    {
        var rides = await db.Rides
            .Where(r => r.RiderId == riderId)
            .OrderByDescending(r => r.RideDateTimeLocal)
            .ToListAsync(cancellationToken);

        var ms = new MemoryStream();

        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            if (rides.Count == 0)
            {
                // Empty dataset: write a single header-only CSV for the current year.
                var currentYear = DateTime.UtcNow.Year;
                WriteYearCsv(archive, currentYear, []);
            }
            else
            {
                var byYear = rides.GroupBy(r => r.RideDateTimeLocal.Year);

                foreach (var group in byYear.OrderByDescending(g => g.Key))
                {
                    WriteYearCsv(archive, group.Key, [.. group]);
                }
            }
        }

        ms.Position = 0;
        return ms;
    }

    private static void WriteYearCsv(
        ZipArchive archive,
        int year,
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> rides
    )
    {
        var entry = archive.CreateEntry($"{year}.csv");

        using var writer = new System.IO.StreamWriter(entry.Open(), System.Text.Encoding.UTF8);

        writer.WriteLine(CsvRowBuilder.BuildHeader(Headers));

        foreach (var ride in rides)
        {
            var row = CsvRowBuilder.BuildRow(
            [
                ride.Id.ToString(),
                ride.RideDateTimeLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
                ride.Miles.ToString("G29"),
                ride.RideMinutes?.ToString(),
                ride.Temperature?.ToString("G29"),
                ride.GasPricePerGallon?.ToString("G29"),
                ride.WindSpeedMph?.ToString("G29"),
                ride.WindDirectionDeg?.ToString(),
                ride.RelativeHumidityPercent?.ToString(),
                ride.CloudCoverPercent?.ToString(),
                ride.PrecipitationType,
                ride.Notes,
                ride.WeatherUserOverridden ? "true" : "false",
                ride.Difficulty?.ToString(),
                ride.PrimaryTravelDirection,
                ride.WindResistanceRating?.ToString(),
                ride.ImportSource,
                ride.SnapshotAverageCarMpg?.ToString("G29"),
                ride.SnapshotMileageRateCents?.ToString("G29"),
                ride.SnapshotYearlyGoalMiles?.ToString("G29"),
                ride.SnapshotOilChangePrice?.ToString("G29"),
                ride.CreatedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            ]);

            writer.WriteLine(row);
        }
    }
}
