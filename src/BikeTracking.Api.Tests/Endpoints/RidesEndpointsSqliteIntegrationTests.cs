using System.Net;
using System.Net.Http.Json;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class RidesEndpointsSqliteIntegrationTests
{
    private static readonly string[] SqliteUnsupportedConstraintMigrations =
    [
        "20260327165005_AddRideMilesUpperBound",
        "20260327171355_FixRideMilesUpperBoundNumericComparison",
    ];

    [Fact]
    public async Task GetRideHistory_WithSqliteMigrationsApplied_ReturnsGasPricePerGallon()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var appliedMigrations = await host.GetAppliedMigrationsAsync();
        Assert.Contains(
            appliedMigrations,
            migration =>
                migration.Contains("AddGasPriceToRidesAndLookupCache", StringComparison.Ordinal)
        );

        var userId = await host.SeedUserAsync("SqliteHistory");
        var rideId = await host.RecordRideAsync(userId, miles: 6.25m, gasPricePerGallon: 3.4567m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);

        var ride = Assert.Single(payload.Rides, r => r.RideId == rideId);
        Assert.Equal(3.4567m, ride.GasPricePerGallon);
    }

    private sealed class SqliteRidesApiHost(WebApplication app, string databasePath)
        : IAsyncDisposable
    {
        public WebApplication App { get; } = app;
        public HttpClient Client { get; } = app.GetTestClient();
        private string DatabasePath { get; } = databasePath;

        public static async Task<SqliteRidesApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();

            var databasePath = Path.Combine(
                Path.GetTempPath(),
                $"biketracking-api-tests-{Guid.NewGuid():N}.db"
            );

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseSqlite($"Data Source={databasePath}")
            );

            builder
                .Services.AddAuthentication("test")
                .AddScheme<TestAuthenticationSchemeOptions, TestAuthenticationHandler>(
                    "test",
                    _ => { }
                );
            builder.Services.AddAuthorization();

            builder.Services.AddScoped<RecordRideService>();
            builder.Services.AddScoped<GetRideDefaultsService>();
            builder.Services.AddScoped<GetQuickRideOptionsService>();
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();
            builder.Services.AddScoped<DeleteRideService>();
            builder.Services.AddScoped<IGasPriceLookupService, StubGasPriceLookupService>();

            var app = builder.Build();

            await using (var scope = app.Services.CreateAsyncScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

                // SQLite cannot execute DropCheckConstraint migrations. Apply the
                // supported migrations, mark those legacy migrations as applied,
                // then continue migration so endpoint queries run on migrated schema.
                await dbContext.Database.MigrateAsync("20260327000000_AddRideVersion");

                var applied = (await dbContext.Database.GetAppliedMigrationsAsync()).ToHashSet();
                foreach (var migration in SqliteUnsupportedConstraintMigrations)
                {
                    if (applied.Contains(migration))
                    {
                        continue;
                    }

                    await dbContext.Database.ExecuteSqlRawAsync(
                        "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ({0}, {1})",
                        migration,
                        "10.0.5"
                    );
                }

                await dbContext.Database.MigrateAsync();
            }

            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new SqliteRidesApiHost(app, databasePath);
        }

        public async Task<IReadOnlyList<string>> GetAppliedMigrationsAsync()
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            var migrations = await dbContext.Database.GetAppliedMigrationsAsync();
            return migrations.ToArray();
        }

        public async Task<long> SeedUserAsync(string displayName)
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var user = new UserEntity
            {
                DisplayName = displayName,
                NormalizedName = displayName.ToLowerInvariant(),
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true,
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();
            return user.UserId;
        }

        public async Task<int> RecordRideAsync(
            long userId,
            decimal miles,
            int? rideMinutes = null,
            decimal? temperature = null,
            decimal? gasPricePerGallon = null
        )
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var ride = new RideEntity
            {
                RiderId = userId,
                RideDateTimeLocal = DateTime.Now,
                Miles = miles,
                RideMinutes = rideMinutes,
                Temperature = temperature,
                GasPricePerGallon = gasPricePerGallon,
                CreatedAtUtc = DateTime.UtcNow,
            };

            dbContext.Rides.Add(ride);
            await dbContext.SaveChangesAsync();
            return ride.Id;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await App.StopAsync();
            await App.DisposeAsync();

            if (File.Exists(DatabasePath))
            {
                try
                {
                    File.Delete(DatabasePath);
                }
                catch (IOException)
                {
                    // Ignore cleanup failure from transient file locks in test teardown.
                }
            }
        }
    }
}
