namespace BikeTracking.Api.Tests.Endpoints.Rides;

using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// TDD RED tests for RecordRide endpoint with Difficulty and PrimaryTravelDirection fields.
/// Tests 1 and 3 (WindResistanceRating computation) are RED: RecordRideService does not yet
/// call the F# WindResistance module, so those fields remain null.
/// Tests 4 and 5 (validation) may already pass since the constraints are on the contracts.
/// </summary>
public sealed class RecordRideWithDifficultyTests
{
    /// <summary>
    /// RED: WindResistanceRating should be 4 for a 20 mph direct headwind when travelling North.
    /// Fails until RecordRideService calls calculateResistance from BikeTracking.Domain.FSharp.
    /// </summary>
    [Fact]
    public async Task PostRecordRide_WithDirectionAndWindData_PersistsWindResistanceRating()
    {
        await using var host = await DifficultyRecordApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WindRatingUser");

        var recordRequest = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 8.0m,
                    RideMinutes: 30,
                    WindSpeedMph: 20m,
                    WindDirectionDeg: 0,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: "North"
                )
            ),
        };
        recordRequest.Headers.Add("X-User-Id", userId.ToString());
        var recordResponse = await host.Client.SendAsync(recordRequest);

        Assert.Equal(HttpStatusCode.Created, recordResponse.StatusCode);
        var payload = await recordResponse.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        var historyRequest = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        historyRequest.Headers.Add("X-User-Id", userId.ToString());
        var historyResponse = await host.Client.SendAsync(historyRequest);

        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var history = await historyResponse.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var ride = Assert.Single(history.Rides, r => r.RideId == payload.RideId);
        Assert.Equal("North", ride.PrimaryTravelDirection);
        Assert.Equal(4, ride.WindResistanceRating);
    }

    /// <summary>
    /// RED: WindResistanceRating should be null when no PrimaryTravelDirection is provided.
    /// Fails until service persists direction-dependent fields correctly.
    /// </summary>
    [Fact]
    public async Task PostRecordRide_WithoutDirection_WindResistanceRatingIsNull()
    {
        await using var host = await DifficultyRecordApiHost.StartAsync();
        var userId = await host.SeedUserAsync("NullRatingUser");

        var recordRequest = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 6.0m,
                    WindSpeedMph: 15m,
                    WindDirectionDeg: 90,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: null
                )
            ),
        };
        recordRequest.Headers.Add("X-User-Id", userId.ToString());
        var recordResponse = await host.Client.SendAsync(recordRequest);

        Assert.Equal(HttpStatusCode.Created, recordResponse.StatusCode);
        var payload = await recordResponse.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        var historyRequest = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        historyRequest.Headers.Add("X-User-Id", userId.ToString());
        var historyResponse = await host.Client.SendAsync(historyRequest);

        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var history = await historyResponse.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var ride = Assert.Single(history.Rides, r => r.RideId == payload.RideId);
        Assert.Null(ride.WindResistanceRating);
    }

    /// <summary>
    /// RED: WindResistanceRating should be 0 when WindSpeedMph is 0 regardless of direction.
    /// Fails until RecordRideService calls the F# module.
    /// </summary>
    [Fact]
    public async Task PostRecordRide_WithZeroWindSpeed_WindResistanceRatingIsZero()
    {
        await using var host = await DifficultyRecordApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ZeroWindUser");

        var recordRequest = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 7.5m,
                    WindSpeedMph: 0m,
                    WindDirectionDeg: 0,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: "North"
                )
            ),
        };
        recordRequest.Headers.Add("X-User-Id", userId.ToString());
        var recordResponse = await host.Client.SendAsync(recordRequest);

        Assert.Equal(HttpStatusCode.Created, recordResponse.StatusCode);
        var payload = await recordResponse.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        var historyRequest = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        historyRequest.Headers.Add("X-User-Id", userId.ToString());
        var historyResponse = await host.Client.SendAsync(historyRequest);

        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var history = await historyResponse.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var ride = Assert.Single(history.Rides, r => r.RideId == payload.RideId);
        Assert.Equal(0, ride.WindResistanceRating);
    }

    /// <summary>
    /// Difficulty = 6 exceeds the [Range(1,5)] constraint — should return 400.
    /// </summary>
    [Fact]
    public async Task PostRecordRide_WithInvalidDifficulty_Returns400()
    {
        await using var host = await DifficultyRecordApiHost.StartAsync();
        var userId = await host.SeedUserAsync("InvalidDifficultyUser");

        var recordRequest = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 5.0m,
                    Difficulty: 6
                )
            ),
        };
        recordRequest.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(recordRequest);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// PrimaryTravelDirection = "Northeast" is 9 characters, exceeds [MaxLength(5)] — returns 400.
    /// </summary>
    [Fact]
    public async Task PostRecordRide_WithInvalidDirection_Returns400()
    {
        await using var host = await DifficultyRecordApiHost.StartAsync();
        var userId = await host.SeedUserAsync("InvalidDirectionUser");

        var recordRequest = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 5.0m,
                    PrimaryTravelDirection: "Northeast"
                )
            ),
        };
        recordRequest.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(recordRequest);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed class DifficultyRecordApiHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<DifficultyRecordApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            var databaseName = Guid.NewGuid().ToString();

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
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
            builder.Services.AddScoped<IGasPriceLookupService, NullGasPriceLookupService>();
            builder.Services.AddScoped<IWeatherLookupService, StubWeatherLookupService>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new DifficultyRecordApiHost(app);
        }

        public async Task<long> SeedUserAsync(string displayName)
        {
            using var scope = App.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var user = new UserEntity
            {
                DisplayName = displayName,
                NormalizedName = displayName.ToLower(),
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true,
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();
            return user.UserId;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }
}

internal sealed class NullGasPriceLookupService : IGasPriceLookupService
{
    public Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<decimal?>(null);

    public Task<decimal?> GetOrFetchAsync(
        DateOnly priceDate,
        DateOnly weekStartDate,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<decimal?>(null);
}
