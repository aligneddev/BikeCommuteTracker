using System.IO.Compression;
using System.Net;

namespace BikeTracking.Api.Tests.Endpoints.Export;

public sealed class RideExportEndpointTests
{
    // ──────────────────────────────────────────────────────────────────────
    // 200 OK — response headers
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_ReturnsOk()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-ok");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetRideExport_ReturnsCorrectContentType()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-ctype");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);

        Assert.Equal("application/zip", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetRideExport_ReturnsCorrectContentDisposition()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-disposition");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition.DispositionType);
        Assert.Equal("ride-history-export.zip", disposition.FileName);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Empty dataset — ZIP containing header-only CSV for current year
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_WithNoRides_ReturnsZipWithSingleHeaderOnlyCsv()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-empty");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);

        Assert.Single(archive.Entries);

        var entry = archive.Entries[0];
        var currentYear = DateTime.UtcNow.Year.ToString();
        Assert.Equal($"{currentYear}.csv", entry.Name);

        using var reader = new System.IO.StreamReader(entry.Open());
        var content = await reader.ReadToEndAsync();
        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        // Only header row
        Assert.Single(lines);
        Assert.StartsWith("RideId,", lines[0]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // ZIP contains one CSV per year
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_WithRidesInMultipleYears_ReturnsOneCsvPerYear()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-multi-year");

        await host.SeedRideAsync(userId, new DateTime(2024, 6, 15), 12.5m);
        await host.SeedRideAsync(userId, new DateTime(2025, 3, 1), 8.0m);
        await host.SeedRideAsync(userId, new DateTime(2026, 1, 10), 10.0m);

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);
        var entryNames = archive.Entries.Select(e => e.Name).ToHashSet();

        Assert.Contains("2024.csv", entryNames);
        Assert.Contains("2025.csv", entryNames);
        Assert.Contains("2026.csv", entryNames);
        Assert.Equal(3, archive.Entries.Count);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Each CSV has correct header
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_EachYearCsvHasCorrectHeader()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-header");

        await host.SeedRideAsync(userId, new DateTime(2025, 6, 1), 10.0m);

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);
        var entry2025 = archive.Entries.Single(e => e.Name == "2025.csv");

        using var reader = new System.IO.StreamReader(entry2025.Open());
        var firstLine = await reader.ReadLineAsync();

        Assert.NotNull(firstLine);
        Assert.StartsWith("RideId,Date,Miles,RideMinutes", firstLine);
        Assert.EndsWith(",CreatedAtUtc", firstLine);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Data rows grouped correctly by year
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_RidesGroupedCorrectlyByYear()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-grouping");

        await host.SeedRideAsync(userId, new DateTime(2024, 12, 31), 5.0m, "Last day 2024");
        await host.SeedRideAsync(userId, new DateTime(2025, 1, 1), 6.0m, "First day 2025");
        await host.SeedRideAsync(userId, new DateTime(2025, 6, 15), 8.0m, "Mid 2025");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);

        var csv2024 = ReadAllLinesFromEntry(archive, "2024.csv");
        var csv2025 = ReadAllLinesFromEntry(archive, "2025.csv");

        // 2024: header + 1 row
        Assert.Equal(2, csv2024.Length);
        Assert.Contains("Last day 2024", csv2024[1]);

        // 2025: header + 2 rows
        Assert.Equal(3, csv2025.Length);
    }

    // ──────────────────────────────────────────────────────────────────────
    // RFC 4180 quoting
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_NoteWithComma_IsRfc4180Quoted()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-quoted");

        await host.SeedRideAsync(userId, new DateTime(2025, 6, 1), 10.0m, "Windy, tough ride");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);
        var lines = ReadAllLinesFromEntry(archive, "2025.csv");

        Assert.Equal(2, lines.Length);
        Assert.Contains("\"Windy, tough ride\"", lines[1]);
    }

    [Fact]
    public async Task GetRideExport_NullOptionalFields_RenderAsBlankCells()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ride-export-null-fields");

        // Seed a ride with only required fields; all optional fields null
        await host.SeedRideAsync(userId, new DateTime(2025, 6, 1), 10.0m, null);

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", userId);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);
        var lines = ReadAllLinesFromEntry(archive, "2025.csv");

        Assert.Equal(2, lines.Length);
        // Row should contain multiple blank cells (consecutive commas)
        Assert.Contains(",,", lines[1]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // User-scoping
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_ReturnsOnlyAuthenticatedUserRides()
    {
        await using var host = await ExportApiHost.StartAsync();
        var riderA = await host.SeedUserAsync("ride-scope-a");
        var riderB = await host.SeedUserAsync("ride-scope-b");

        await host.SeedRideAsync(riderA, new DateTime(2025, 1, 1), 5.0m, "Rider A ride");
        await host.SeedRideAsync(riderB, new DateTime(2025, 1, 2), 9.0m, "Rider B ride");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/rides", riderA);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        using var archive = new ZipArchive(new System.IO.MemoryStream(bytes), ZipArchiveMode.Read);
        var lines = ReadAllLinesFromEntry(archive, "2025.csv");

        // header + 1 ride for riderA only
        Assert.Equal(2, lines.Length);
        Assert.Contains("Rider A ride", string.Join('\n', lines));
        Assert.DoesNotContain("Rider B ride", string.Join('\n', lines));
    }

    // ──────────────────────────────────────────────────────────────────────
    // 401 for missing auth header
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRideExport_WithoutAuthHeader_Returns401()
    {
        await using var host = await ExportApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/exports/rides");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────────────────────────────────

    private static string[] ReadAllLinesFromEntry(ZipArchive archive, string entryName)
    {
        var entry = archive.Entries.Single(e => e.Name == entryName);
        using var reader = new System.IO.StreamReader(entry.Open());
        var content = reader.ReadToEnd();
        return content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
    }
}
