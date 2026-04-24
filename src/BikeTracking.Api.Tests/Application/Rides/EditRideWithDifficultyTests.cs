namespace BikeTracking.Api.Tests.Application.Rides;

using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using Xunit;

/// <summary>
/// TDD RED tests for EditRide endpoint with direction-change wind resistance behaviour.
/// Tests 1, 2, and 3 are RED: EditRideService does not yet recompute WindResistanceRating
/// when PrimaryTravelDirection changes.
/// Test 4 (Difficulty stored as rider choice) may pass or fail depending on current service.
/// </summary>
public sealed class EditRideWithDifficultyTests
{
    /// <summary>
    /// RED: When direction is unchanged after edit, WindResistanceRating must remain the same.
    /// Fails until EditRideService preserves WindResistanceRating on unchanged direction.
    /// </summary>
    [Fact]
    public async Task EditRide_WhenDirectionUnchanged_WindResistanceRatingUnchanged()
    {
        await using var host = await EditDifficultyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("DirectionUnchanged");

        // Record ride with North direction and 20 mph headwind (rating = 4)
        var recordReq = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
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
        recordReq.Headers.Add("X-User-Id", userId.ToString());
        var recordResp = await host.Client.SendAsync(recordReq);
        Assert.Equal(HttpStatusCode.Created, recordResp.StatusCode);
        var recorded = await recordResp.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(recorded);

        // Get history to capture current WindResistanceRating
        var histReq1 = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        histReq1.Headers.Add("X-User-Id", userId.ToString());
        var histResp1 = await host.Client.SendAsync(histReq1);
        var history1 = await histResp1.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history1);
        var originalRide = Assert.Single(history1.Rides, r => r.RideId == recorded.RideId);
        var originalRating = originalRide.WindResistanceRating;

        // Edit ride keeping direction "North"
        var editReq = new HttpRequestMessage(HttpMethod.Put, $"/api/rides/{recorded.RideId}")
        {
            Content = JsonContent.Create(
                new EditRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 9.0m,
                    RideMinutes: 35,
                    Temperature: null,
                    ExpectedVersion: 1,
                    WindSpeedMph: 20m,
                    WindDirectionDeg: 0,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: "North"
                )
            ),
        };
        editReq.Headers.Add("X-User-Id", userId.ToString());
        var editResp = await host.Client.SendAsync(editReq);
        Assert.Equal(HttpStatusCode.OK, editResp.StatusCode);

        // History after edit — rating should be unchanged
        var histReq2 = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        histReq2.Headers.Add("X-User-Id", userId.ToString());
        var histResp2 = await host.Client.SendAsync(histReq2);
        var history2 = await histResp2.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history2);
        var editedRide = Assert.Single(history2.Rides, r => r.RideId == recorded.RideId);
        Assert.Equal(originalRating, editedRide.WindResistanceRating);
    }

    /// <summary>
    /// RED: Changing direction from North to South with same 20 mph wind flips rating from +4 to -4.
    /// Fails until EditRideService recomputes WindResistanceRating on direction change.
    /// </summary>
    [Fact]
    public async Task EditRide_WhenDirectionChanged_WindResistanceRatingRecomputed()
    {
        await using var host = await EditDifficultyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("DirectionChanged");

        // Record ride: travel North, wind from 0° = headwind → rating should be +4
        var recordReq = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
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
        recordReq.Headers.Add("X-User-Id", userId.ToString());
        var recordResp = await host.Client.SendAsync(recordReq);
        Assert.Equal(HttpStatusCode.Created, recordResp.StatusCode);
        var recorded = await recordResp.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(recorded);

        // Edit ride: change direction to South — same wind from 0° becomes tailwind → rating -4
        var editReq = new HttpRequestMessage(HttpMethod.Put, $"/api/rides/{recorded.RideId}")
        {
            Content = JsonContent.Create(
                new EditRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 8.0m,
                    RideMinutes: 30,
                    Temperature: null,
                    ExpectedVersion: 1,
                    WindSpeedMph: 20m,
                    WindDirectionDeg: 0,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: "South"
                )
            ),
        };
        editReq.Headers.Add("X-User-Id", userId.ToString());
        var editResp = await host.Client.SendAsync(editReq);
        Assert.Equal(HttpStatusCode.OK, editResp.StatusCode);

        // History after edit — rating should be -4 (tailwind)
        var histReq = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        histReq.Headers.Add("X-User-Id", userId.ToString());
        var histResp = await host.Client.SendAsync(histReq);
        var history = await histResp.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var editedRide = Assert.Single(history.Rides, r => r.RideId == recorded.RideId);
        Assert.Equal(-4, editedRide.WindResistanceRating);
    }

    /// <summary>
    /// RED: Clearing PrimaryTravelDirection sets WindResistanceRating to null.
    /// Fails until EditRideService handles direction being cleared.
    /// </summary>
    [Fact]
    public async Task EditRide_WhenDirectionCleared_WindResistanceRatingNull()
    {
        await using var host = await EditDifficultyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("DirectionCleared");

        // Record with direction set
        var recordReq = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 7.0m,
                    RideMinutes: 25,
                    WindSpeedMph: 10m,
                    WindDirectionDeg: 180,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: "North"
                )
            ),
        };
        recordReq.Headers.Add("X-User-Id", userId.ToString());
        var recordResp = await host.Client.SendAsync(recordReq);
        Assert.Equal(HttpStatusCode.Created, recordResp.StatusCode);
        var recorded = await recordResp.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(recorded);

        // Edit ride, clearing PrimaryTravelDirection
        var editReq = new HttpRequestMessage(HttpMethod.Put, $"/api/rides/{recorded.RideId}")
        {
            Content = JsonContent.Create(
                new EditRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 7.0m,
                    RideMinutes: 25,
                    Temperature: null,
                    ExpectedVersion: 1,
                    WindSpeedMph: 10m,
                    WindDirectionDeg: 180,
                    WeatherUserOverridden: true,
                    PrimaryTravelDirection: null
                )
            ),
        };
        editReq.Headers.Add("X-User-Id", userId.ToString());
        var editResp = await host.Client.SendAsync(editReq);
        Assert.Equal(HttpStatusCode.OK, editResp.StatusCode);

        var histReq = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        histReq.Headers.Add("X-User-Id", userId.ToString());
        var histResp = await host.Client.SendAsync(histReq);
        var history = await histResp.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var editedRide = Assert.Single(history.Rides, r => r.RideId == recorded.RideId);
        Assert.Null(editedRide.WindResistanceRating);
    }

    /// <summary>
    /// Difficulty is rider's explicit choice and must not be overridden by the server.
    /// Records without difficulty, edits with Difficulty = 2, expects history to show 2.
    /// </summary>
    [Fact]
    public async Task EditRide_DifficultyStoredAsRiderChoice_NotOverridden()
    {
        await using var host = await EditDifficultyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("DifficultyChoice");

        // Record without difficulty
        var recordReq = new HttpRequestMessage(HttpMethod.Post, "/api/rides")
        {
            Content = JsonContent.Create(
                new RecordRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 5.5m,
                    RideMinutes: 22
                )
            ),
        };
        recordReq.Headers.Add("X-User-Id", userId.ToString());
        var recordResp = await host.Client.SendAsync(recordReq);
        Assert.Equal(HttpStatusCode.Created, recordResp.StatusCode);
        var recorded = await recordResp.Content.ReadFromJsonAsync<RecordRideSuccessResponse>();
        Assert.NotNull(recorded);

        // Edit with explicit Difficulty = 2
        var editReq = new HttpRequestMessage(HttpMethod.Put, $"/api/rides/{recorded.RideId}")
        {
            Content = JsonContent.Create(
                new EditRideRequest(
                    RideDateTimeLocal: DateTime.Now,
                    Miles: 5.5m,
                    RideMinutes: 22,
                    Temperature: null,
                    ExpectedVersion: 1,
                    Difficulty: 2
                )
            ),
        };
        editReq.Headers.Add("X-User-Id", userId.ToString());
        var editResp = await host.Client.SendAsync(editReq);
        Assert.Equal(HttpStatusCode.OK, editResp.StatusCode);

        var histReq = new HttpRequestMessage(HttpMethod.Get, "/api/rides/history");
        histReq.Headers.Add("X-User-Id", userId.ToString());
        var histResp = await host.Client.SendAsync(histReq);
        var history = await histResp.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(history);
        var editedRide = Assert.Single(history.Rides, r => r.RideId == recorded.RideId);
        Assert.Equal(2, editedRide.Difficulty);
    }

    private sealed class EditDifficultyApiHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<EditDifficultyApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            var databaseName = Guid.NewGuid().ToString();

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
            );
            builder
                .Services.AddAuthentication("test")
                .AddScheme<
                    EditDifficultyTestAuthSchemeOptions,
                    EditDifficultyTestAuthHandler
                >("test", _ => { });
            builder.Services.AddAuthorization();

            builder.Services.AddScoped<RecordRideService>();
            builder.Services.AddScoped<GetRideDefaultsService>();
            builder.Services.AddScoped<GetQuickRideOptionsService>();
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();
            builder.Services.AddScoped<IGasPriceLookupService, EditDifficultyNullGasPriceLookupService>();
            builder.Services.AddScoped<IWeatherLookupService, EditDifficultyNullWeatherLookupService>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new EditDifficultyApiHost(app);
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

file sealed class EditDifficultyTestAuthSchemeOptions
    : Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions { }

file sealed class EditDifficultyTestAuthHandler
    : Microsoft.AspNetCore.Authentication.AuthenticationHandler<EditDifficultyTestAuthSchemeOptions>
{
    public EditDifficultyTestAuthHandler(
        IOptionsMonitor<EditDifficultyTestAuthSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        System.Text.Encodings.Web.UrlEncoder encoder
    )
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new[] { new Claim("sub", userIdString) };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new System.Security.Principal.GenericPrincipal(identity, null);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

file sealed class EditDifficultyNullGasPriceLookupService : IGasPriceLookupService
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

file sealed class EditDifficultyNullWeatherLookupService : IWeatherLookupService
{
    public Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<WeatherData?>(null);
}
