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

    [Fact]
    public async Task RidePreset_WithDuplicateNameForSameRider_ViolatesUniqueConstraint()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var riderId = await host.SeedUserAsync("PresetUnique");

        await host.CreateRidePresetAsync(riderId, "Morning", "07:45", 30);

        await Assert.ThrowsAsync<DbUpdateException>(async () =>
            await host.CreateRidePresetAsync(riderId, "Morning", "08:15", 40)
        );
    }

    [Fact]
    public async Task RidePreset_WithSameNameAcrossRiders_IsAllowed()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var riderA = await host.SeedUserAsync("PresetRiderA");
        var riderB = await host.SeedUserAsync("PresetRiderB");

        await host.CreateRidePresetAsync(riderA, "Morning", "07:45", 30);
        await host.CreateRidePresetAsync(riderB, "Morning", "08:15", 40);

        var riderAPresets = await host.GetPresetCountForRiderAsync(riderA);
        var riderBPresets = await host.GetPresetCountForRiderAsync(riderB);

        Assert.Equal(1, riderAPresets);
        Assert.Equal(1, riderBPresets);
    }

    [Fact]
    public async Task RidePreset_StoresExactStartTime()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var riderId = await host.SeedUserAsync("PresetTime");
        var presetId = await host.CreateRidePresetAsync(riderId, "Afternoon", "17:35", 32);

        var preset = await host.GetRidePresetAsync(presetId);

        Assert.NotNull(preset);
        Assert.Equal(new TimeOnly(17, 35), preset.ExactStartTimeLocal);
        Assert.Equal("afternoon", preset.PeriodTag);
    }

    [Fact]
    public async Task GetRidePresets_WithoutAuth_ReturnsUnauthorized()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/presets");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateRidePreset_WithoutAuth_ReturnsUnauthorized()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var response = await host.Client.PostAsJsonAsync(
            "/api/rides/presets",
            new UpsertRidePresetRequest(
                Name: "Unauthorized",
                PrimaryDirection: "SW",
                PeriodTag: "morning",
                ExactStartTimeLocal: "07:45",
                DurationMinutes: 30
            )
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RidePresets_AreOrderedByMostRecentlyUsedAfterSuccessfulRideSave()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var riderId = await host.SeedUserAsync("PresetMruOrder");
        var morningPresetId = await host.CreateRidePresetAsync(riderId, "Morning", "07:45", 30);
        var afternoonPresetId = await host.CreateRidePresetAsync(riderId, "Afternoon", "17:35", 32);

        var recordRideResponse = await host.Client.PostWithAuthAsync(
            "/api/rides",
            new RecordRideRequest(
                RideDateTimeLocal: DateTime.Now,
                Miles: 8.2m,
                RideMinutes: 30,
                SelectedPresetId: morningPresetId
            ),
            riderId
        );
        Assert.Equal(HttpStatusCode.Created, recordRideResponse.StatusCode);

        var presetsResponse = await host.Client.GetWithAuthAsync("/api/rides/presets", riderId);
        Assert.Equal(HttpStatusCode.OK, presetsResponse.StatusCode);

        var payload = await presetsResponse.Content.ReadFromJsonAsync<RidePresetsResponse>();
        Assert.NotNull(payload);
        Assert.Equal(2, payload.Presets.Count);
        Assert.Equal(morningPresetId, payload.Presets[0].PresetId);
        Assert.Equal(afternoonPresetId, payload.Presets[1].PresetId);
    }

    [Fact]
    public async Task RecordRide_WithSelectedPreset_UpdatesPresetLastUsedAtUtc()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var riderId = await host.SeedUserAsync("PresetMruUpdate");
        var presetId = await host.CreateRidePresetAsync(riderId, "Morning", "07:45", 30);

        var before = await host.GetRidePresetAsync(presetId);
        Assert.NotNull(before);
        Assert.Null(before.LastUsedAtUtc);

        var response = await host.Client.PostWithAuthAsync(
            "/api/rides",
            new RecordRideRequest(
                RideDateTimeLocal: DateTime.Now,
                Miles: 6.4m,
                RideMinutes: 28,
                SelectedPresetId: presetId
            ),
            riderId
        );
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var after = await host.GetRidePresetAsync(presetId);
        Assert.NotNull(after);
        Assert.NotNull(after.LastUsedAtUtc);
    }

    [Fact]
    public async Task RecordRide_WithSelectedPresetOwnedByAnotherRider_ReturnsBadRequest()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var ownerRiderId = await host.SeedUserAsync("PresetOwner");
        var attackerRiderId = await host.SeedUserAsync("PresetAttacker");
        var ownerPresetId = await host.CreateRidePresetAsync(
            ownerRiderId,
            "OwnerPreset",
            "07:45",
            30
        );

        var beforeRideCount = await host.GetRideCountForRiderAsync(attackerRiderId);

        var response = await host.Client.PostWithAuthAsync(
            "/api/rides",
            new RecordRideRequest(
                RideDateTimeLocal: DateTime.Now,
                Miles: 7.1m,
                RideMinutes: 29,
                SelectedPresetId: ownerPresetId
            ),
            attackerRiderId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var afterRideCount = await host.GetRideCountForRiderAsync(attackerRiderId);
        Assert.Equal(beforeRideCount, afterRideCount);
    }

    [Fact]
    public async Task UpdateRidePreset_WithPresetOwnedByAnotherRider_ReturnsNotFound()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var ownerRiderId = await host.SeedUserAsync("PresetUpdateOwner");
        var attackerRiderId = await host.SeedUserAsync("PresetUpdateAttacker");
        var ownerPresetId = await host.CreateRidePresetAsync(
            ownerRiderId,
            "OwnerMorning",
            "07:45",
            30
        );

        var response = await host.Client.PutWithAuthAsync(
            $"/api/rides/presets/{ownerPresetId}",
            new UpsertRidePresetRequest(
                Name: "Hijacked",
                PrimaryDirection: "NE",
                PeriodTag: "afternoon",
                ExactStartTimeLocal: "17:15",
                DurationMinutes: 33
            ),
            attackerRiderId
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var preset = await host.GetRidePresetAsync(ownerPresetId);
        Assert.NotNull(preset);
        Assert.Equal("OwnerMorning", preset.Name);
        Assert.Equal("SW", preset.PrimaryDirection);
    }

    [Fact]
    public async Task DeleteRidePreset_WithPresetOwnedByAnotherRider_ReturnsNotFound()
    {
        await using var host = await SqliteRidesApiHost.StartAsync();

        var ownerRiderId = await host.SeedUserAsync("PresetDeleteOwner");
        var attackerRiderId = await host.SeedUserAsync("PresetDeleteAttacker");
        var ownerPresetId = await host.CreateRidePresetAsync(
            ownerRiderId,
            "OwnerAfternoon",
            "17:35",
            32
        );

        var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/rides/presets/{ownerPresetId}"
        );
        deleteRequest.Headers.Add("X-User-Id", attackerRiderId.ToString());

        var response = await host.Client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var preset = await host.GetRidePresetAsync(ownerPresetId);
        Assert.NotNull(preset);
        Assert.Equal(ownerRiderId, preset.RiderId);
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
            builder.Services.AddScoped<IRidePresetService, RidePresetService>();
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();
            builder.Services.AddScoped<DeleteRideService>();
            builder.Services.AddScoped<IGasPriceLookupService, StubGasPriceLookupService>();
            builder.Services.AddScoped<IWeatherLookupService, StubWeatherLookupService>();

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

        public async Task<long> CreateRidePresetAsync(
            long riderId,
            string name,
            string exactStartTime,
            int durationMinutes
        )
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var preset = new RidePresetEntity
            {
                RiderId = riderId,
                Name = name,
                PrimaryDirection = "SW",
                PeriodTag = name == "Afternoon" ? "afternoon" : "morning",
                ExactStartTimeLocal = TimeOnly.ParseExact(exactStartTime, "HH:mm"),
                DurationMinutes = durationMinutes,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
                Version = 1,
            };

            dbContext.RidePresets.Add(preset);
            await dbContext.SaveChangesAsync();
            return preset.RidePresetId;
        }

        public async Task<int> GetPresetCountForRiderAsync(long riderId)
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            return await dbContext.RidePresets.CountAsync(x => x.RiderId == riderId);
        }

        public async Task<int> GetRideCountForRiderAsync(long riderId)
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            return await dbContext.Rides.CountAsync(x => x.RiderId == riderId);
        }

        public async Task<RidePresetEntity?> GetRidePresetAsync(long presetId)
        {
            await using var scope = App.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            return await dbContext
                .RidePresets.AsNoTracking()
                .SingleOrDefaultAsync(x => x.RidePresetId == presetId);
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
