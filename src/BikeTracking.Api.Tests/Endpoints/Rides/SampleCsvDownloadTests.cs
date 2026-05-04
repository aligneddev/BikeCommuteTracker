using System.Net;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints.Rides;

/// <summary>
/// Tests for GET /api/rides/csv-sample endpoint (Feature 019).
/// Tests are RED until SampleCsvGenerator and the endpoint route are implemented.
/// </summary>
public sealed class SampleCsvDownloadTests
{
    [Fact]
    public async Task GetCsvSample_ReturnsOk()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetCsvSample_ReturnsTextCsvContentType()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);

        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetCsvSample_ReturnsContentDispositionAttachment()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition.DispositionType);
        Assert.Equal("ride-import-sample.csv", disposition.FileName);
    }

    [Fact]
    public async Task GetCsvSample_BodyContainsDifficultyAndDirectionHeaders()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("Difficulty", body);
        Assert.Contains("Direction", body);
    }

    [Fact]
    public async Task GetCsvSample_BodyContainsExampleDataRows()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        // Should have at least one data row (non-comment line with commas)
        var dataLines = body.Split('\n')
            .Where(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#'))
            .Skip(1) // skip header row
            .ToList();
        Assert.True(dataLines.Count >= 1, "Expected at least one example data row");
    }

    [Fact]
    public async Task GetCsvSample_BodyContainsLegendCommentLines()
    {
        await using var host = await SampleCsvHost.StartAsync();
        var userId = await host.SeedUserAsync("SampleUser");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        var commentLines = body.Split('\n')
            .Where(line => line.TrimStart().StartsWith('#'))
            .ToList();
        Assert.True(commentLines.Count >= 1, "Expected at least one # comment/legend line");
    }

    [Fact]
    public async Task GetCsvSample_RequiresAuthentication()
    {
        await using var host = await SampleCsvHost.StartAsync();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/rides/csv-sample");
        // No auth header
        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class SampleCsvHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<SampleCsvHost> StartAsync()
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
            builder.Services.AddScoped<GetRideHistoryService>();
            builder.Services.AddScoped<EditRideService>();
            builder.Services.AddScoped<IGasPriceLookupService, NullGasPriceLookupService>();
            builder.Services.AddScoped<IWeatherLookupService, StubWeatherLookupService>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapRidesEndpoints();
            await app.StartAsync();

            return new SampleCsvHost(app);
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
            await App.DisposeAsync();
        }
    }
}
