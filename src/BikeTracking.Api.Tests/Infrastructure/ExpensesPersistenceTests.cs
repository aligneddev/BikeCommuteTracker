using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Infrastructure;

public sealed class ExpensesPersistenceTests
{
    [Fact]
    public async Task SqliteMigrations_ApplyIncludingAddExpensesTable()
    {
        await using var harness = await SqliteExpenseDbHarness.StartAsync();

        var appliedMigrations = await harness.Context.Database.GetAppliedMigrationsAsync();

        Assert.Contains(
            appliedMigrations,
            migration => migration.Contains("AddExpensesTable", StringComparison.Ordinal)
        );
    }

    [Fact]
    public async Task DbContext_CanSaveExpenseEntity_WithAllConfiguredFields()
    {
        await using var harness = await SqliteExpenseDbHarness.StartAsync();

        var user = new UserEntity
        {
            DisplayName = "Expense Rider",
            NormalizedName = "expense rider",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true,
        };

        harness.Context.Users.Add(user);
        await harness.Context.SaveChangesAsync();

        var expense = new ExpenseEntity
        {
            RiderId = user.UserId,
            ExpenseDate = new DateTime(2026, 4, 17),
            Amount = 49.95m,
            Notes = "New tire",
            ReceiptPath = "1/10/receipt.pdf",
            IsDeleted = false,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        harness.Context.Expenses.Add(expense);
        await harness.Context.SaveChangesAsync();

        var retrieved = await harness.Context.Expenses.SingleAsync();
        Assert.Equal(user.UserId, retrieved.RiderId);
        Assert.Equal(expense.ExpenseDate, retrieved.ExpenseDate);
        Assert.Equal(49.95m, retrieved.Amount);
        Assert.Equal("New tire", retrieved.Notes);
        Assert.Equal("1/10/receipt.pdf", retrieved.ReceiptPath);
        Assert.False(retrieved.IsDeleted);
        Assert.Equal(1, retrieved.Version);
    }

    private sealed class SqliteExpenseDbHarness : IAsyncDisposable
    {
        private SqliteExpenseDbHarness(BikeTrackingDbContext context, string databasePath)
        {
            Context = context;
            DatabasePath = databasePath;
        }

        public BikeTrackingDbContext Context { get; }

        private string DatabasePath { get; }

        public static async Task<SqliteExpenseDbHarness> StartAsync()
        {
            var databasePath = Path.Combine(
                Path.GetTempPath(),
                $"biketracking-expenses-tests-{Guid.NewGuid():N}.db"
            );

            var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
                .UseSqlite($"Data Source={databasePath}")
                .Options;

            var context = new BikeTrackingDbContext(options);

            await SqliteMigrationBootstrapper.ApplyCompatibilityWorkaroundsAsync(
                context,
                NullLogger.Instance
            );
            await context.Database.MigrateAsync();

            return new SqliteExpenseDbHarness(context, databasePath);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();

            foreach (
                var path in new[] { DatabasePath, $"{DatabasePath}-shm", $"{DatabasePath}-wal" }
            )
            {
                if (!File.Exists(path))
                {
                    continue;
                }

                try
                {
                    File.Delete(path);
                }
                catch (IOException)
                {
                    // Ignore transient cleanup failures from SQLite file locks.
                }
            }
        }
    }
}
