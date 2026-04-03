using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class RidesEndpointsTests
{
    [Fact]
    public async Task PostRecordRide_WithValidRequest_Returns201AndRideId()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Alice");

        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.5m,
            RideMinutes: 45,
            Temperature: 72m
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.RideId > 0);
        Assert.Equal(userId, payload.RiderId);
        Assert.NotEqual(DateTime.MinValue, payload.SavedAtUtc);
    }

    [Fact]
    public async Task PostRecordRide_WithRequiredFieldsOnly_Returns201()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Bob");

        var request = new RecordRideRequest(RideDateTimeLocal: DateTime.Now, Miles: 5.0m);

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.RideId > 0);
    }

    [Fact]
    public async Task PostRecordRide_WithInvalidMiles_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Charlie");

        var request = new RecordRideRequest(RideDateTimeLocal: DateTime.Now, Miles: -1m);

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostRecordRide_WithMilesAboveMaximum_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Cleo");

        var request = new RecordRideRequest(RideDateTimeLocal: DateTime.Now, Miles: 200.01m);

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostRecordRide_WithInvalidRideMinutes_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Diana");

        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10m,
            RideMinutes: -5
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostRecordRide_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var request = new RecordRideRequest(RideDateTimeLocal: DateTime.Now, Miles: 10m);

        var response = await host.Client.PostAsJsonAsync("/api/rides", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetRideDefaults_WithoutPriorRides_ReturnsCurrentDateTime()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Eve");

        var response = await host.Client.GetWithAuthAsync("/api/rides/defaults", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideDefaultsResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.HasPreviousRide);
        Assert.Null(payload.DefaultMiles);
        Assert.NotEqual(DateTime.MinValue, payload.DefaultRideDateTimeLocal);
    }

    [Fact]
    public async Task GetRideDefaults_WithPriorRides_ReturnsLastDefaults()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Frank");

        // Record a ride
        await host.RecordRideAsync(
            userId,
            miles: 10.5m,
            rideMinutes: 45,
            temperature: 72m,
            gasPricePerGallon: 3.4999m
        );

        var response = await host.Client.GetWithAuthAsync("/api/rides/defaults", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideDefaultsResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.HasPreviousRide);
        Assert.Equal(10.5m, payload.DefaultMiles);
        Assert.Equal(45, payload.DefaultRideMinutes);
        Assert.Equal(72m, payload.DefaultTemperature);
        Assert.Equal(3.4999m, payload.DefaultGasPricePerGallon);
    }

    [Fact]
    public async Task GetRideDefaults_WithWeatherOnPreviousRide_ReturnsWeatherDefaults()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WeatherDefaults");

        using (var scope = host.App.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            dbContext.Rides.Add(
                new RideEntity
                {
                    RiderId = userId,
                    RideDateTimeLocal = DateTime.Now.AddHours(-3),
                    Miles = 6.6m,
                    RideMinutes = 24,
                    Temperature = 61m,
                    WindSpeedMph = 10.3m,
                    WindDirectionDeg = 255,
                    RelativeHumidityPercent = 71,
                    CloudCoverPercent = 48,
                    PrecipitationType = "snow",
                    WeatherUserOverridden = true,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
            await dbContext.SaveChangesAsync();
        }

        var response = await host.Client.GetWithAuthAsync("/api/rides/defaults", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideDefaultsResponse>();
        Assert.NotNull(payload);
        Assert.Equal(10.3m, payload.DefaultWindSpeedMph);
        Assert.Equal(255, payload.DefaultWindDirectionDeg);
        Assert.Equal(71, payload.DefaultRelativeHumidityPercent);
        Assert.Equal(48, payload.DefaultCloudCoverPercent);
        Assert.Equal("snow", payload.DefaultPrecipitationType);
    }

    [Fact]
    public async Task GetGasPrice_WithValidDate_ReturnsShape()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceUser");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=2026-03-31",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<GasPriceResponse>();
        Assert.NotNull(payload);
        Assert.Equal("2026-03-31", payload.Date);
        Assert.Equal("Source: U.S. Energy Information Administration (EIA)", payload.DataSource);
    }

    [Fact]
    public async Task GetGasPrice_WithInvalidDate_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceBadDate");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=not-a-date",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetGasPrice_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/gas-price?date=2026-03-31");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostRecordRide_WithGasPrice_PersistsGasPrice()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPricePersist");

        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.5m,
            RideMinutes: 45,
            Temperature: 72m,
            GasPricePerGallon: 3.2777m
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == payload.RideId);
        Assert.Equal(3.2777m, ride.GasPricePerGallon);
    }

    [Fact]
    public async Task PostRecordRide_WithWeatherFields_PersistsWeatherSnapshot()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WeatherPersist");

        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 9.4m,
            RideMinutes: 34,
            Temperature: 57m,
            GasPricePerGallon: 3.1010m,
            WindSpeedMph: 12.2m,
            WindDirectionDeg: 275,
            RelativeHumidityPercent: 64,
            CloudCoverPercent: 52,
            PrecipitationType: "rain",
            WeatherUserOverridden: true
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == payload.RideId);

        Assert.Equal(12.2m, ride.WindSpeedMph);
        Assert.Equal(275, ride.WindDirectionDeg);
        Assert.Equal(64, ride.RelativeHumidityPercent);
        Assert.Equal(52, ride.CloudCoverPercent);
        Assert.Equal("rain", ride.PrecipitationType);
        Assert.True(ride.WeatherUserOverridden);
    }

    [Fact]
    public async Task PostRecordRide_WithNullGasPrice_PersistsNull()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceNull");

        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 5.0m,
            RideMinutes: null,
            Temperature: null,
            GasPricePerGallon: null
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(payload);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == payload.RideId);
        Assert.Null(ride.GasPricePerGallon);
    }

    [Fact]
    public async Task GetRideDefaults_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/defaults");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetQuickRideOptions_WithAuth_Returns200()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("QuickOptionsUser");
        await host.RecordRideAsync(userId, miles: 11.5m, rideMinutes: 39, temperature: 65m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/quick-options", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<QuickRideOptionsResponse>();
        Assert.NotNull(payload);
        Assert.NotNull(payload.Options);
        Assert.NotEmpty(payload.Options);
    }

    [Fact]
    public async Task GetQuickRideOptions_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/quick-options");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetQuickRideOptions_ExcludesRidesWithoutRideMinutes()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("QuickOptionsIncomplete");
        await host.RecordRideAsync(userId, miles: 11.5m, rideMinutes: 39, temperature: 65m);
        await host.RecordRideAsync(userId, miles: 7.25m, rideMinutes: null, temperature: 55m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/quick-options", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<QuickRideOptionsResponse>();
        Assert.NotNull(payload);
        Assert.All(payload.Options, option => Assert.True(option.RideMinutes > 0));
        Assert.DoesNotContain(payload.Options, option => option.Miles == 7.25m);
    }

    [Fact]
    public async Task GetQuickRideOptions_WithoutEligibleRides_ReturnsEmptyOptionsArray()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("QuickOptionsEmpty");

        var response = await host.Client.GetWithAuthAsync("/api/rides/quick-options", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<QuickRideOptionsResponse>();
        Assert.NotNull(payload);
        Assert.Empty(payload.Options);
    }

    // History endpoint tests

    [Fact]
    public async Task GetRideHistory_WithRides_ReturnsSuccessResponse()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Georgia");

        // Record rides
        await host.RecordRideAsync(userId, miles: 10.5m);
        await host.RecordRideAsync(userId, miles: 5.2m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.NotNull(payload.Summaries);
        Assert.NotNull(payload.FilteredTotal);
        Assert.NotEmpty(payload.Rides);
        Assert.True(payload.Rides.Count >= 2);
        Assert.Equal(1, payload.Page);
        Assert.True(payload.TotalRows >= 2);
    }

    [Fact]
    public async Task GetRideHistory_WithDateRangeFilter_ReturnsFilteredRows()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Harper");

        await host.RecordRideAsync(userId, miles: 10m);
        await host.RecordRideAsync(userId, miles: 5m);

        var today = DateOnly.FromDateTime(DateTime.Now);
        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/rides/history?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"
        );
        request.Headers.Add("X-User-Id", userId.ToString());

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.TotalRows >= 1);
        Assert.True(payload.FilteredTotal.Miles > 0);
    }

    [Fact]
    public async Task GetRideHistory_WithoutRides_ReturnsEmptyWithZeroSummaries()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Henry");

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.Empty(payload.Rides);
        Assert.Equal(0, payload.TotalRows);
        Assert.Equal(0, payload.Summaries.AllTime.Miles);
        Assert.Equal(0, payload.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistory_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/history");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetRideHistory_WithInvalidDateRange_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Ivy");

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/rides/history?from=2025-12-31&to=2025-01-01"
        );
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_WithValidRequest_Returns200AndUpdatedVersion()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Jules");
        var rideId = await host.RecordRideAsync(
            userId,
            miles: 8.5m,
            rideMinutes: 30,
            temperature: 65m
        );

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now.AddMinutes(-10),
            Miles: 11.25m,
            RideMinutes: 42,
            Temperature: 68m,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<EditRideResponse>();
        Assert.NotNull(payload);
        Assert.Equal(rideId, payload.RideId);
        Assert.Equal(2, payload.NewVersion);
    }

    [Fact]
    public async Task PutEditRide_WithGasPrice_StoresGasPrice()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceEdit");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m, gasPricePerGallon: 3.0000m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.25m,
            RideMinutes: 39,
            Temperature: 68m,
            ExpectedVersion: 1,
            GasPricePerGallon: 3.5555m
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == rideId);
        Assert.Equal(3.5555m, ride.GasPricePerGallon);
    }

    [Fact]
    public async Task PutEditRide_WithNullGasPrice_StoresNull()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceEditNull");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m, gasPricePerGallon: 3.0000m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 9.25m,
            RideMinutes: 33,
            Temperature: 68m,
            ExpectedVersion: 1,
            GasPricePerGallon: null
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == rideId);
        Assert.Null(ride.GasPricePerGallon);
    }

    [Fact]
    public async Task PutEditRide_WithInvalidPayload_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Luca");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 0m,
            RideMinutes: null,
            Temperature: null,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_WithMilesAboveMaximum_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Liam");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 250m,
            RideMinutes: null,
            Temperature: null,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_ForDifferentRiderRide_Returns403()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var ownerId = await host.SeedUserAsync("Mira");
        var otherUserId = await host.SeedUserAsync("Noah");
        var rideId = await host.RecordRideAsync(ownerId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.2m,
            RideMinutes: 39,
            Temperature: 67m,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync(
            $"/api/rides/{rideId}",
            request,
            otherUserId
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_WithStaleExpectedVersion_Returns409()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Omar");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.2m,
            RideMinutes: 39,
            Temperature: 67m,
            ExpectedVersion: 99
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_ThenGetHistory_ReturnsEditedMilesInRowsAndTotals()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Pia");
        var rideId = await host.RecordRideAsync(
            userId,
            miles: 6.0m,
            rideMinutes: 31,
            temperature: 64m
        );

        var editRequest = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.25m,
            RideMinutes: 35,
            Temperature: 67m,
            ExpectedVersion: 1
        );

        var editResponse = await host.Client.PutWithAuthAsync(
            $"/api/rides/{rideId}",
            editRequest,
            userId
        );
        Assert.Equal(HttpStatusCode.OK, editResponse.StatusCode);

        var historyResponse = await host.Client.GetWithAuthAsync("/api/rides/history", userId);
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);

        var payload = await historyResponse.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);

        var editedRide = Assert.Single(payload.Rides, r => r.RideId == rideId);
        Assert.Equal(10.25m, editedRide.Miles);
        Assert.Equal(10.25m, payload.FilteredTotal.Miles);
        Assert.Equal(10.25m, payload.Summaries.AllTime.Miles);
    }

    [Fact]
    public async Task GetRideHistory_ContainsGasPricePerGallon()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceHistory");
        var rideId = await host.RecordRideAsync(userId, miles: 6.0m, gasPricePerGallon: 3.4444m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        var ride = Assert.Single(payload.Rides, r => r.RideId == rideId);
        Assert.Equal(3.4444m, ride.GasPricePerGallon);
    }

    private sealed class RecordRideApiHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<RecordRideApiHost> StartAsync()
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

            // Add Rides services
            builder.Services.AddScoped<RecordRideService>();
            builder.Services.AddScoped<GetRideDefaultsService>();
            builder.Services.AddScoped<GetQuickRideOptionsService>();
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();
            builder.Services.AddScoped<IGasPriceLookupService, StubGasPriceLookupService>();
            builder.Services.AddScoped<IWeatherLookupService, StubWeatherLookupService>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new RecordRideApiHost(app);
        }

        public async Task<long> SeedUserAsync(string displayName)
        {
            using var scope = app.Services.CreateScope();
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

        public async Task<int> RecordRideAsync(
            long userId,
            decimal miles,
            int? rideMinutes = null,
            decimal? temperature = null,
            decimal? gasPricePerGallon = null
        )
        {
            using var scope = app.Services.CreateScope();
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

            dbContext.Add(ride);
            await dbContext.SaveChangesAsync();
            return ride.Id;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }
}

internal class TestAuthenticationSchemeOptions
    : Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions { }

internal class TestAuthenticationHandler
    : Microsoft.AspNetCore.Authentication.AuthenticationHandler<TestAuthenticationSchemeOptions>
{
    public TestAuthenticationHandler(
        Microsoft.Extensions.Options.IOptionsMonitor<TestAuthenticationSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        System.Text.Encodings.Web.UrlEncoder encoder
    )
        : base(options, logger, encoder) { }

    protected override Task<Microsoft.AspNetCore.Authentication.AuthenticateResult> HandleAuthenticateAsync()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString))
            return Task.FromResult(
                Microsoft.AspNetCore.Authentication.AuthenticateResult.NoResult()
            );

        var claims = new[] { new Claim("sub", userIdString) };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new System.Security.Principal.GenericPrincipal(identity, null);
        var ticket = new Microsoft.AspNetCore.Authentication.AuthenticationTicket(
            principal,
            Scheme.Name
        );
        return Task.FromResult(
            Microsoft.AspNetCore.Authentication.AuthenticateResult.Success(ticket)
        );
    }
}

internal static class HttpClientExtensions
{
    public static async Task<HttpResponseMessage> PostWithAuthAsync<T>(
        this HttpClient client,
        string requestUri,
        T value,
        long userId
    )
    {
        var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(value),
        };
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    public static async Task<HttpResponseMessage> GetWithAuthAsync(
        this HttpClient client,
        string requestUri,
        long userId
    )
    {
        var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    public static async Task<HttpResponseMessage> PutWithAuthAsync<T>(
        this HttpClient client,
        string requestUri,
        T value,
        long userId
    )
    {
        var request = new HttpRequestMessage(HttpMethod.Put, requestUri)
        {
            Content = JsonContent.Create(value),
        };
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }
}

internal sealed class StubGasPriceLookupService : IGasPriceLookupService
{
    public Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        CancellationToken cancellationToken = default
    )
    {
        if (date == new DateOnly(2026, 3, 31))
        {
            return Task.FromResult<decimal?>(3.1860m);
        }

        return Task.FromResult<decimal?>(null);
    }
}

internal sealed class StubWeatherLookupService : IWeatherLookupService
{
    public Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        CancellationToken cancellationToken = default
    )
    {
        if (latitude == 40.71m && longitude == -74.01m)
        {
            return Task.FromResult<WeatherData?>(
                new WeatherData(
                    Temperature: 72.5m,
                    WindSpeedMph: 10.3m,
                    WindDirectionDeg: 250,
                    RelativeHumidityPercent: 65,
                    CloudCoverPercent: 30,
                    PrecipitationType: null
                )
            );
        }

        return Task.FromResult<WeatherData?>(null);
    }
}
