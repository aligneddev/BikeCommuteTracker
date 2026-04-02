using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class RidesEndpointsSqliteIntegrationTests
{
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

                await SqliteMigrationBootstrapper.ApplyCompatibilityWorkaroundsAsync(
                    dbContext,
                    NullLogger.Instance
                );

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
