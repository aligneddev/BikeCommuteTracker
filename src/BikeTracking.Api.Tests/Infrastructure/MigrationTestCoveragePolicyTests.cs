using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BikeTracking.Api.Tests.Infrastructure;

public sealed class MigrationTestCoveragePolicyTests
{
    private static readonly IReadOnlyDictionary<string, string> MigrationVerificationLedger =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["202603130001_InitialUserIdentity"] =
                "Updated test: user endpoint/auth integration tests validate identity schema behavior.",
            ["20260323134325_AddRidesTable"] =
                "Added test: rides endpoint integration tests validate ride persistence and retrieval.",
            ["20260327000000_AddRideVersion"] =
                "Added test: edit ride endpoint tests validate optimistic concurrency version handling.",
            ["20260327165005_AddRideMilesUpperBound"] =
                "Updated test: rides validation tests enforce miles upper bound behavior.",
            ["20260327171355_FixRideMilesUpperBoundNumericComparison"] =
                "Updated test: rides validation tests verify numeric comparison semantics in SQLite-backed flows.",
            ["20260330202303_AddUserSettingsTable"] =
                "Added test: user settings endpoint integration tests validate persistence and retrieval contract.",
            ["20260331135119_AddGasPriceToRidesAndLookupCache"] =
                "Added test: SQLite endpoint integration tests validate gas price column retrieval after migration.",
            ["20260403192400_AddWeatherFieldsToRides"] =
                "Added test: rides persistence tests validate weather columns round-trip after schema migration.",
            ["20260403192854_AddWeatherLookupCache"] =
                "Added test: weather lookup service tests validate cache read/write through weather lookup table.",
            ["20260406183601_AddDashboardSnapshotsAndPreferences"] =
                "Added test: dashboard and user settings coverage validates snapshot and preference columns after schema migration.",
            ["20260408185627_AddCsvRideImport"] =
                "Added test: import endpoint and persistence integration coverage validates ImportJobs and ImportRows schema after migration.",
        };

    [Fact]
    public void EveryMigrationMustHaveCoverageLedgerEntry()
    {
        using var context = CreateContext();
        var discoveredMigrations = context
            .GetService<IMigrationsAssembly>()
            .Migrations.Keys.OrderBy(static id => id, StringComparer.Ordinal)
            .ToArray();

        var missing = discoveredMigrations.Except(MigrationVerificationLedger.Keys).ToArray();
        var stale = MigrationVerificationLedger.Keys.Except(discoveredMigrations).ToArray();

        Assert.True(
            missing.Length == 0,
            $"Missing migration coverage entries: {string.Join(", ", missing)}"
        );
        Assert.True(
            stale.Length == 0,
            $"Ledger contains non-existent migrations: {string.Join(", ", stale)}"
        );
    }

    [Fact]
    public void EveryCoverageEntryMustDeclareAddedOrUpdatedTestAction()
    {
        var invalid = MigrationVerificationLedger
            .Where(static entry =>
                !entry.Value.StartsWith("Added test:", StringComparison.Ordinal)
                && !entry.Value.StartsWith("Updated test:", StringComparison.Ordinal)
            )
            .Select(static entry => entry.Key)
            .ToArray();

        Assert.True(
            invalid.Length == 0,
            $"Coverage entries must start with 'Added test:' or 'Updated test:'. Invalid entries: {string.Join(", ", invalid)}"
        );
    }

    private static BikeTrackingDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BikeTrackingDbContext(options);
    }
}
