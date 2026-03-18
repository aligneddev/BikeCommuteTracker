using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
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

            var app = builder.Build();
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
