namespace BikeTracking.Api.Tests.Endpoints.Rides;

using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
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
using Xunit;

/// <summary>
/// TDD RED-GREEN: Tests for DELETE /api/rides/{rideId} endpoint.
/// These tests should FAIL initially (endpoint not yet implemented).
/// STATUS: RED (endpoint not yet wired)
/// </summary>
public sealed class DeleteRideEndpointTests
{
    [Fact]
    public async Task DeleteRide_WithMissingAuthHeader_Returns401Unauthorized()
    {
        await using var host = await DeleteRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Alice");
        var rideId = await host.RecordRideAsync(userId, miles: 5.5m);

        var response = await host.Client.DeleteAsync($"/api/rides/{rideId}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRide_WithValidRequest_Returns200Ok()
    {
        await using var host = await DeleteRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Bob");
        var rideId = await host.RecordRideAsync(userId, miles: 7.2m);

        var response = await host.Client.DeleteWithAuthAsync($"/api/rides/{rideId}", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<DeleteRideSuccessResponse>();
        Assert.NotNull(payload);
        Assert.Equal(rideId, payload.RideId);
    }

    [Fact]
    public async Task DeleteRide_AsNonOwner_Returns403Forbidden()
    {
        await using var host = await DeleteRideApiHost.StartAsync();
        var ownerUserId = await host.SeedUserAsync("Owner");
        var attackerUserId = await host.SeedUserAsync("Attacker");
        var rideId = await host.RecordRideAsync(ownerUserId, miles: 6.0m);

        var response = await host.Client.DeleteWithAuthAsync(
            $"/api/rides/{rideId}",
            attackerUserId
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRide_WithNonExistentRide_Returns404NotFound()
    {
        await using var host = await DeleteRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Charlie");

        var response = await host.Client.DeleteWithAuthAsync("/api/rides/9999", userId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRide_AlreadyDeleted_ReturnsIdempotent200Ok()
    {
        await using var host = await DeleteRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Diana");
        var rideId = await host.RecordRideAsync(userId, miles: 8.1m);

        var response1 = await host.Client.DeleteWithAuthAsync($"/api/rides/{rideId}", userId);
        Assert.Equal(HttpStatusCode.OK, response1.StatusCode);

        var response2 = await host.Client.DeleteWithAuthAsync($"/api/rides/{rideId}", userId);
        Assert.Equal(HttpStatusCode.OK, response2.StatusCode);
        var payload = await response2.Content.ReadFromJsonAsync<DeleteRideSuccessResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsIdempotent);
    }

    private sealed class DeleteRideApiHost(WebApplication app) : IAsyncDisposable
    {
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<DeleteRideApiHost> StartAsync()
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
            builder.Services.AddScoped<DeleteRideService>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new DeleteRideApiHost(app);
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

internal sealed record DeleteRideSuccessResponse(
    int RideId,
    DateTime DeletedAtUtc,
    bool IsIdempotent = false
);

internal class TestAuthenticationSchemeOptions
    : Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions { }

internal class TestAuthenticationHandler
    : Microsoft.AspNetCore.Authentication.AuthenticationHandler<TestAuthenticationSchemeOptions>
{
    public TestAuthenticationHandler(
        IOptionsMonitor<TestAuthenticationSchemeOptions> options,
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

internal static class HttpClientExtensions
{
    public static async Task<HttpResponseMessage> DeleteWithAuthAsync(
        this HttpClient client,
        string requestUri,
        long userId
    )
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, requestUri);
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }
}
