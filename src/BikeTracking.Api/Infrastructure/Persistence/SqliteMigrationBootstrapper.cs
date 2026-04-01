using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Infrastructure.Persistence;

public static class SqliteMigrationBootstrapper
{
    private static readonly string[] UnsupportedConstraintMigrations =
    [
        "20260327165005_AddRideMilesUpperBound",
        "20260327171355_FixRideMilesUpperBoundNumericComparison",
    ];

    public static async Task ApplyCompatibilityWorkaroundsAsync(
        BikeTrackingDbContext dbContext,
        ILogger logger
    )
    {
        if (dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
        {
            return;
        }

        await ClearStaleMigrationLockAsync(dbContext, logger);

        var applied = (await dbContext.Database.GetAppliedMigrationsAsync()).ToHashSet();
        var requiresSqliteWorkaround = UnsupportedConstraintMigrations.Any(migration =>
            !applied.Contains(migration)
        );

        if (!requiresSqliteWorkaround)
        {
            return;
        }

        await dbContext.Database.MigrateAsync("20260327000000_AddRideVersion");

        applied = (await dbContext.Database.GetAppliedMigrationsAsync()).ToHashSet();
        var productVersion = GetEfProductVersion();

        foreach (var migration in UnsupportedConstraintMigrations)
        {
            if (applied.Contains(migration))
            {
                continue;
            }

            await dbContext.Database.ExecuteSqlRawAsync(
                "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ({0}, {1})",
                migration,
                productVersion
            );
        }
    }

    private static async Task ClearStaleMigrationLockAsync(
        BikeTrackingDbContext dbContext,
        ILogger logger
    )
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldCloseConnection = connection.State != System.Data.ConnectionState.Open;

        if (shouldCloseConnection)
        {
            await connection.OpenAsync();
        }

        int hasLockTable;
        await using (var command = connection.CreateCommand())
        {
            command.CommandText =
                "SELECT COUNT(*) FROM \"sqlite_master\" WHERE \"name\" = '__EFMigrationsLock' AND \"type\" = 'table'";
            var scalar = await command.ExecuteScalarAsync();
            hasLockTable = Convert.ToInt32(scalar);
        }

        if (shouldCloseConnection)
        {
            await connection.CloseAsync();
        }

        if (hasLockTable == 0)
        {
            return;
        }

        // If a previous process crashed during migration, SQLite can retain a stale
        // lock row and cause all future startups to wait forever acquiring the lock.
        // Only remove lock rows older than 30 seconds to avoid interfering with
        // legitimate in-progress migrations.
        var clearedLockRows = await dbContext.Database.ExecuteSqlRawAsync(
            "DELETE FROM \"__EFMigrationsLock\" WHERE \"Id\" = 1 AND \"Timestamp\" < datetime('now', '-30 seconds')"
        );
        if (clearedLockRows > 0)
        {
            logger.LogWarning(
                "Cleared {RowCount} stale EF migration lock row(s) before startup migration.",
                clearedLockRows
            );
        }
    }

    private static string GetEfProductVersion()
    {
        var infoVersion = typeof(DbContext)
            .Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion;

        if (!string.IsNullOrWhiteSpace(infoVersion))
        {
            var plusIndex = infoVersion.IndexOf('+');
            return plusIndex > 0 ? infoVersion[..plusIndex] : infoVersion;
        }

        return typeof(DbContext).Assembly.GetName().Version?.ToString() ?? "unknown";
    }
}
