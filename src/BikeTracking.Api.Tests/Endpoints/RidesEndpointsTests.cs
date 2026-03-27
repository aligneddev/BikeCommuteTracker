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
        await host.RecordRideAsync(userId, miles: 10.5m, rideMinutes: 45, temperature: 72m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/defaults", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideDefaultsResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.HasPreviousRide);
        Assert.Equal(10.5m, payload.DefaultMiles);
        Assert.Equal(45, payload.DefaultRideMinutes);
        Assert.Equal(72m, payload.DefaultTemperature);
    }

    [Fact]
    public async Task GetRideDefaults_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/defaults");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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

    private sealed class RecordRideApiHost(WebApplication app) : IAsyncDisposable
    {
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
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();

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
            decimal? temperature = null
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
