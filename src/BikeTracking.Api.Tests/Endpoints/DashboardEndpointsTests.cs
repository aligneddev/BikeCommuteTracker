using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class DashboardEndpointsTests
{
    [Fact]
    public async Task GetDashboard_Returns200AndDashboardPayload_ForAuthenticatedRider()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Dashboard Rider", "1234");

        var response = await host.Client.GetWithAuthAsync("/api/dashboard", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<DashboardResponse>();
        Assert.NotNull(payload);
        Assert.Equal(0m, payload.Totals.CurrentMonthMiles.Miles);
    }

    private sealed class DashboardApiHost(WebApplication app) : IAsyncDisposable
    {
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<DashboardApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            var databaseName = Guid.NewGuid().ToString();

            builder.Services.Configure<IdentityOptions>(_ => { });
            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
            );
            builder.Services.AddSingleton<IPinHasher, PinHasher>();
            builder.Services.AddScoped<UserSettingsService>();
            builder.Services.AddScoped<GetDashboardService>();
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
            TryMapDashboardEndpoints(app);
            await app.StartAsync();

            return new DashboardApiHost(app);
        }

        public async Task<long> SeedUserAsync(string displayName, string pin)
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

            await dbContext.SaveChangesAsync();
            return user.UserId;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }

        private static void TryMapDashboardEndpoints(IEndpointRouteBuilder endpoints)
        {
            var dashboardEndpointsType = typeof(UsersEndpoints).Assembly.GetType(
                "BikeTracking.Api.Endpoints.DashboardEndpoints"
            );
            var mapMethod = dashboardEndpointsType?.GetMethod(
                "MapDashboardEndpoints",
                [typeof(IEndpointRouteBuilder)]
            );

            mapMethod?.Invoke(null, [endpoints]);
        }
    }
}
