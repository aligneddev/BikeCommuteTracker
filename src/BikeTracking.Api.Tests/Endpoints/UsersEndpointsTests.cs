using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class UsersEndpointsTests
{
    [Fact]
    public async Task Identify_Returns400_ForInvalidRequest()
    {
        await using var host = await IdentifyApiHost.StartAsync();

        var response = await host.Client.PostAsJsonAsync(
            "/api/users/identify",
            new IdentifyRequest("", "")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(payload);
        Assert.Equal(UsersErrorCodes.ValidationFailed, payload.Code);
        Assert.NotNull(payload.Details);
    }

    [Fact]
    public async Task Identify_Returns401_ForUnknownUser()
    {
        await using var host = await IdentifyApiHost.StartAsync();

        var response = await host.Client.PostAsJsonAsync(
            "/api/users/identify",
            new IdentifyRequest("Unknown", "1234")
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Identify_Returns200_ForValidCredentials()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Alice", "1234");

        var response = await host.Client.PostAsJsonAsync(
            "/api/users/identify",
            new IdentifyRequest("Alice", "1234")
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<IdentifySuccessResponse>();
        Assert.NotNull(payload);
        Assert.Equal(userId, payload.UserId);
        Assert.Equal("Alice", payload.UserName);
        Assert.True(payload.Authorized);
    }

    [Fact]
    public async Task Identify_Returns429AndRetryAfterHeader_WhenUserIsThrottled()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        await host.SeedUserAsync(
            "Alice",
            "1234",
            new AuthAttemptStateEntity
            {
                ConsecutiveWrongCount = 3,
                LastWrongAttemptUtc = DateTime.UtcNow,
                DelayUntilUtc = DateTime.UtcNow.AddSeconds(5),
            }
        );

        var response = await host.Client.PostAsJsonAsync(
            "/api/users/identify",
            new IdentifyRequest("Alice", "1234")
        );

        Assert.Equal((HttpStatusCode)429, response.StatusCode);
        Assert.True(response.Headers.TryGetValues("Retry-After", out var retryAfterValues));

        var retryAfterHeader = retryAfterValues?.SingleOrDefault();
        Assert.False(string.IsNullOrWhiteSpace(retryAfterHeader));

        var payload = await response.Content.ReadFromJsonAsync<ThrottleResponse>();
        Assert.NotNull(payload);
        Assert.Equal(UsersErrorCodes.Throttled, payload.Code);
        Assert.Equal(payload.RetryAfterSeconds.ToString(), retryAfterHeader);
    }

    [Fact]
    public async Task GetUserSettings_Returns401_WithoutAuthentication()
    {
        await using var host = await IdentifyApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/users/me/settings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PutThenGetUserSettings_ReturnsPersistedValues_ForAuthenticatedUser()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Casey", "1234");

        var putResponse = await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31.5m,
                YearlyGoalMiles: 1800m,
                OilChangePrice: 89.99m,
                MileageRateCents: 67.5m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await host.Client.GetWithAuthAsync("/api/users/me/settings", userId);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var payload = await getResponse.Content.ReadFromJsonAsync<UserSettingsResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.HasSettings);
        Assert.Equal(31.5m, payload.Settings.AverageCarMpg);
        Assert.Equal(1800m, payload.Settings.YearlyGoalMiles);
    }

    [Fact]
    public async Task PutThenGetUserSettings_PersistsLocationCoordinates_ForAuthenticatedUser()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("LocationCase", "1234");

        var putResponse = await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31.5m,
                YearlyGoalMiles: 1800m,
                OilChangePrice: 89.99m,
                MileageRateCents: 67.5m,
                LocationLabel: "Downtown Office",
                Latitude: 42.3601m,
                Longitude: -71.0589m
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await host.Client.GetWithAuthAsync("/api/users/me/settings", userId);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var payload = await getResponse.Content.ReadFromJsonAsync<UserSettingsResponse>();
        Assert.NotNull(payload);
        Assert.Equal("Downtown Office", payload.Settings.LocationLabel);
        Assert.Equal(42.3601m, payload.Settings.Latitude);
        Assert.Equal(-71.0589m, payload.Settings.Longitude);
    }

    [Fact]
    public async Task PutUserSettings_ClearsExplicitlyNullField_ForAuthenticatedUser()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ClearFieldCase", "1234");

        var firstPut = await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 29.5m,
                YearlyGoalMiles: 1100m,
                OilChangePrice: 75m,
                MileageRateCents: 51m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, firstPut.StatusCode);

        var secondPut = await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: null,
                YearlyGoalMiles: 1100m,
                OilChangePrice: 75m,
                MileageRateCents: 51m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, secondPut.StatusCode);

        var getResponse = await host.Client.GetWithAuthAsync("/api/users/me/settings", userId);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var payload = await getResponse.Content.ReadFromJsonAsync<UserSettingsResponse>();
        Assert.NotNull(payload);
        Assert.Null(payload.Settings.AverageCarMpg);
        Assert.Equal(1100m, payload.Settings.YearlyGoalMiles);
    }

    [Fact]
    public async Task GetUserSettings_ReturnsRiderScopedValues_ForEachAuthenticatedUser()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var firstUserId = await host.SeedUserAsync("ScopeUserOne", "1234");
        var secondUserId = await host.SeedUserAsync("ScopeUserTwo", "1234");

        await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 20m,
                YearlyGoalMiles: 900m,
                OilChangePrice: 50m,
                MileageRateCents: 40m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            firstUserId
        );

        await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 33m,
                YearlyGoalMiles: 2100m,
                OilChangePrice: 92m,
                MileageRateCents: 68m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            secondUserId
        );

        var firstGet = await host.Client.GetWithAuthAsync("/api/users/me/settings", firstUserId);
        var secondGet = await host.Client.GetWithAuthAsync("/api/users/me/settings", secondUserId);

        var firstPayload = await firstGet.Content.ReadFromJsonAsync<UserSettingsResponse>();
        var secondPayload = await secondGet.Content.ReadFromJsonAsync<UserSettingsResponse>();

        Assert.NotNull(firstPayload);
        Assert.NotNull(secondPayload);
        Assert.Equal(20m, firstPayload.Settings.AverageCarMpg);
        Assert.Equal(33m, secondPayload.Settings.AverageCarMpg);
    }

    [Fact]
    public async Task PutThenGetUserSettings_RoundTripsDashboardApprovals()
    {
        await using var host = await IdentifyApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ApprovalsCase", "1234");

        var putResponse = await host.Client.PutWithAuthAsync(
            "/api/users/me/settings",
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31m,
                YearlyGoalMiles: 2000m,
                OilChangePrice: 75m,
                MileageRateCents: 67m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null,
                DashboardGallonsAvoidedEnabled: true,
                DashboardGoalProgressEnabled: true
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var payload = await putResponse.Content.ReadFromJsonAsync<UserSettingsResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.Settings.DashboardGallonsAvoidedEnabled);
        Assert.True(payload.Settings.DashboardGoalProgressEnabled);

        var getResponse = await host.Client.GetWithAuthAsync("/api/users/me/settings", userId);
        var getPayload = await getResponse.Content.ReadFromJsonAsync<UserSettingsResponse>();

        Assert.NotNull(getPayload);
        Assert.True(getPayload.Settings.DashboardGallonsAvoidedEnabled);
        Assert.True(getPayload.Settings.DashboardGoalProgressEnabled);
    }

    private sealed class IdentifyApiHost(WebApplication app) : IAsyncDisposable
    {
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<IdentifyApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            var databaseName = Guid.NewGuid().ToString();

            builder.Services.Configure<IdentityOptions>(_ => { });
            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
            );
            builder.Services.AddScoped<PinPolicyValidator>();
            builder.Services.AddSingleton<IPinHasher, PinHasher>();
            builder.Services.AddScoped<SignupService>();
            builder.Services.AddScoped<IdentifyService>();
            builder.Services.AddScoped<UserSettingsService>();
            builder
                .Services.AddAuthentication(UserIdHeaderAuthenticationHandler.SchemeName)
                .AddScheme<
                    UserIdHeaderAuthenticationSchemeOptions,
                    UserIdHeaderAuthenticationHandler
                >(UserIdHeaderAuthenticationHandler.SchemeName, _ => { });
            builder.Services.AddAuthorization();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapUsersEndpoints();
            await app.StartAsync();

            return new IdentifyApiHost(app);
        }

        public async Task<long> SeedUserAsync(
            string displayName,
            string pin,
            AuthAttemptStateEntity? attemptState = null
        )
        {
            using var scope = app.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPinHasher>();

            var hashResult = hasher.Hash(pin);
            var user = new UserEntity
            {
                DisplayName = displayName,
                NormalizedName = UserNameNormalizer.Normalize(displayName),
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true,
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();

            dbContext.UserCredentials.Add(
                new UserCredentialEntity
                {
                    UserId = user.UserId,
                    PinHash = hashResult.Hash,
                    PinSalt = hashResult.Salt,
                    HashAlgorithm = hashResult.Algorithm,
                    IterationCount = hashResult.Iterations,
                    CredentialVersion = hashResult.CredentialVersion,
                    UpdatedAtUtc = DateTime.UtcNow,
                }
            );

            if (attemptState is not null)
            {
                attemptState.UserId = user.UserId;
                dbContext.AuthAttemptStates.Add(attemptState);
            }

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
