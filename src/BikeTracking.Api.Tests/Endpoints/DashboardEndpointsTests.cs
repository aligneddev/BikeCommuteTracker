using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
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

    [Fact]
    public async Task GetDashboard_MoneySavedContract_ExposesSplitFields_AndOmitsCombinedSavings()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Dashboard Contract Rider", "1234");

        var response = await host.Client.GetWithAuthAsync("/api/dashboard", userId);
        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var moneySaved = json.RootElement.GetProperty("totals").GetProperty("moneySaved");

        Assert.True(moneySaved.TryGetProperty("mileageRateSavings", out _));
        Assert.True(moneySaved.TryGetProperty("fuelCostAvoided", out _));
        Assert.True(moneySaved.TryGetProperty("qualifiedRideCount", out _));
        Assert.False(moneySaved.TryGetProperty("combinedSavings", out _));
    }

    [Fact]
    public async Task GetYearStats_Returns200AndYearStatsPayload_ForAuthenticatedRider()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Year Stats Rider", "1234");

        var response = await host.Client.GetWithAuthAsync(
            "/api/dashboard/year-stats?year=2025",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<YearStatsDashboardResponse>();
        Assert.NotNull(payload);
        Assert.Equal(2025, payload.Year);
    }

    [Fact]
    public async Task GetYearStats_Returns400_ForYearBelowMinimumBound()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Year Stats Rider Low", "1234");

        var response = await host.Client.GetWithAuthAsync(
            "/api/dashboard/year-stats?year=1899",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetYearStats_Returns400_ForYearAboveMaximumBound()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Year Stats Rider High", "1234");

        var response = await host.Client.GetWithAuthAsync(
            $"/api/dashboard/year-stats?year={DateTime.Now.Year + 2}",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetYearStats_Returns400_ForNonNumericYear()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Year Stats Rider NaN", "1234");

        var response = await host.Client.GetWithAuthAsync(
            "/api/dashboard/year-stats?year=abcd",
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetYearStats_Returns401_WhenUnauthenticated()
    {
        await using var host = await DashboardApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/dashboard/year-stats?year=2025");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetAvailableYears_Returns200AndDescendingDistinctYears_ForSeededRider()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Available Years Rider", "1234");

        var response = await host.Client.GetWithAuthAsync(
            "/api/dashboard/year-stats/years",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<AvailableYearsResponse>();
        Assert.NotNull(payload);
        Assert.Equal([DateTime.Now.Year], payload.Years);
    }

    [Fact]
    public async Task GetAvailableYears_Returns401_WhenUnauthenticated()
    {
        await using var host = await DashboardApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/dashboard/year-stats/years");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TotalRideMinutes_AgreesAcrossDashboardEndpoints()
    {
        await using var host = await DashboardApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Riding Time Consistency Rider", "1234");
        var currentYear = DateTime.Now.Year;

        await host.SeedRideAsync(userId, new DateTime(currentYear - 1, 12, 31, 8, 0, 0), 10m, 45);
        await host.SeedRideAsync(userId, new DateTime(currentYear, 1, 1, 8, 0, 0), 10m, 30);
        await host.SeedRideAsync(userId, DateTime.Now, 10m, 90);
        await host.SeedRideAsync(userId, DateTime.Now, 5m);

        using var dashboard = await GetJsonAsync(host, "/api/dashboard", userId);
        using var advanced = await GetJsonAsync(host, "/api/dashboard/advanced", userId);
        using var yearStats = await GetJsonAsync(
            host,
            $"/api/dashboard/year-stats?year={currentYear}",
            userId
        );

        Assert.Equal(
            165,
            dashboard.RootElement.GetProperty("totals").GetProperty("totalRideMinutes").GetInt32()
        );
        Assert.Equal(165, advanced.RootElement.GetProperty("totalRideMinutes").GetInt32());
        Assert.Equal(
            120,
            yearStats.RootElement.GetProperty("totals").GetProperty("totalRideMinutes").GetInt32()
        );
    }

    private static async Task<JsonDocument> GetJsonAsync(
        DashboardApiHost host,
        string url,
        long userId
    )
    {
        var response = await host.Client.GetWithAuthAsync(url, userId);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
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
            builder.Services.AddScoped<GetAdvancedDashboardService>();
            builder.Services.AddScoped<GetYearStatsDashboardService>();
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

        public async Task SeedRideAsync(
            long riderId,
            DateTime rideDateTimeLocal,
            decimal miles,
            int? rideMinutes = null
        )
        {
            using var scope = app.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            dbContext.Rides.Add(
                new RideEntity
                {
                    RiderId = riderId,
                    RideDateTimeLocal = rideDateTimeLocal,
                    Miles = miles,
                    RideMinutes = rideMinutes,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
            await dbContext.SaveChangesAsync();
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
