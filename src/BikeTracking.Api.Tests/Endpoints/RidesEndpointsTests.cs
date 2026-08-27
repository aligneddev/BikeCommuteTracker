using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed partial class RidesEndpointsTests
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
    public async Task PostRecordRide_ResponseShape_RemainsRideEntryFocused()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Ride Shape");

        var request = new RecordRideRequest(RideDateTimeLocal: DateTime.Now, Miles: 7.5m);
        var response = await host.Client.PostWithAuthAsync("/api/rides", request, userId);
        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.True(root.TryGetProperty("rideId", out _));
        Assert.True(root.TryGetProperty("riderId", out _));
        Assert.True(root.TryGetProperty("savedAtUtc", out _));
        Assert.False(root.TryGetProperty("moneySaved", out _));
        Assert.False(root.TryGetProperty("combinedSavings", out _));
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
    public async Task GetGasPrice_WithValidDate_ReturnsShape()
    {
        StubGasPriceLookupService.Reset();
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
        Assert.Equal("Regular", payload.Grade);
    }

    [Fact]
    public async Task GetGasPrice_WithInvalidDate_Returns400()
    {
        StubGasPriceLookupService.Reset();
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
        StubGasPriceLookupService.Reset();
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/gas-price?date=2026-03-31");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetGasPrice_WithoutGradeOverride_UsesSavedGasGradePreference()
    {
        StubGasPriceLookupService.Reset();
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceSavedGrade");
        await host.SeedUserSettingsAsync(userId, gasGrade: "Premium");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=2026-03-31",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<GasPriceResponse>();
        Assert.NotNull(payload);
        Assert.Equal("Premium", payload.Grade);
        Assert.Equal("Premium", StubGasPriceLookupService.LastRequestedGrade);
    }

    [Fact]
    public async Task GetGasPrice_WithGradeOverride_UsesOverrideWithoutPersistingPreference()
    {
        StubGasPriceLookupService.Reset();
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceOverride");
        await host.SeedUserSettingsAsync(userId, gasGrade: "Regular");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=2026-03-31&grade=Premium",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<GasPriceResponse>();
        Assert.NotNull(payload);
        Assert.Equal("Premium", payload.Grade);
        Assert.Equal("Premium", StubGasPriceLookupService.LastRequestedGrade);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var settings = await dbContext.UserSettings.SingleAsync(x => x.UserId == userId);
        Assert.Equal("Regular", settings.GasGrade);
    }

    [Fact]
    public async Task GetGasPrice_WithInvalidGradeOverride_Returns400InvalidRequest()
    {
        StubGasPriceLookupService.Reset();
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceInvalidGrade");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=2026-03-31&grade=midgrade",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(payload);
        Assert.Equal("INVALID_REQUEST", payload.Code);
    }

    [Fact]
    public async Task GetGasPrice_ResponseIncludesGradeWhenPriceUnavailable()
    {
        StubGasPriceLookupService.Reset();
        StubGasPriceLookupService.ReturnNullPrice = true;
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceUnavailableGrade");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/gas-price?date=2026-03-31&grade=Premium",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<GasPriceResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.IsAvailable);
        Assert.Null(payload.PricePerGallon);
        Assert.Equal("Premium", payload.Grade);

        StubGasPriceLookupService.ReturnNullPrice = false;
    }

    [Fact]
    public async Task GetRideWeather_WithConfiguredLocation_ReturnsWeatherData()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WeatherPreview");
        await host.SeedUserSettingsAsync(userId, latitude: 40.71m, longitude: -74.01m);

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideWeatherResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAvailable);
        Assert.Equal(72.5m, payload.Temperature);
        Assert.Equal(10.3m, payload.WindSpeedMph);
        Assert.Equal(250, payload.WindDirectionDeg);
        Assert.Equal(65, payload.RelativeHumidityPercent);
        Assert.Equal(30, payload.CloudCoverPercent);
    }

    [Fact]
    public async Task GetRideWeather_WithInvalidDateTime_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WeatherPreviewBadDate");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/weather?rideDateTimeLocal=not-a-date-time",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetRideWeather_WithoutLocation_ReturnsUnavailableShape()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("WeatherPreviewNoLocation");

        var response = await host.Client.GetWithAuthAsync(
            "/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideWeatherResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.IsAvailable);
        Assert.Null(payload.Temperature);
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

    private sealed class RecordRideApiHost : IAsyncDisposable
    {
        private readonly WebApplication app;
        public WebApplication App => app;
        public HttpClient Client { get; }

        public RecordRideApiHost(WebApplication app)
        {
            this.app = app;
            Client = app.GetTestClient();
        }

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
            builder.Services.AddScoped<IRidePresetService, RidePresetService>();
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

        public async Task SeedUserSettingsAsync(
            long userId,
            decimal? latitude = null,
            decimal? longitude = null,
            string gasGrade = "Regular"
        )
        {
            using var scope = app.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            dbContext.UserSettings.Add(
                new UserSettingsEntity
                {
                    UserId = userId,
                    GasGrade = gasGrade,
                    Latitude = latitude,
                    Longitude = longitude,
                    UpdatedAtUtc = DateTime.UtcNow,
                }
            );

            await dbContext.SaveChangesAsync();
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
    public static bool ReturnNullPrice { get; set; }
    public static string LastRequestedGrade { get; private set; } = "Regular";

    public static void Reset()
    {
        ReturnNullPrice = false;
        LastRequestedGrade = "Regular";
    }

    public Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    )
    {
        LastRequestedGrade = grade;
        if (ReturnNullPrice)
        {
            return Task.FromResult<decimal?>(null);
        }

        if (grade.Equals("Premium", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult<decimal?>(3.4860m);
        }

        if (date == new DateOnly(2026, 3, 31))
        {
            return Task.FromResult<decimal?>(3.1860m);
        }

        return Task.FromResult<decimal?>(null);
    }

    public Task<decimal?> GetOrFetchAsync(
        DateOnly priceDate,
        DateOnly weekStartDate,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    )
    {
        // Delegate to the single-date overload for stub behavior
        return GetOrFetchAsync(priceDate, grade, apiKey, cancellationToken);
    }
}

internal sealed class StubWeatherLookupService : IWeatherLookupService
{
    public Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        string? apiKey = null,
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
