using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Application.Notifications;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class ImportEndpointsTests
{
    [Fact]
    public async Task PostPreview_WithValidCsv_ReturnsSummaryAndRows()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var csv =
            "Date,Miles,Time,Temp,Tags,Notes\n2026-04-01,12.5,45,60,commute,morning\n2026-04-02,0,45,62,commute,invalid miles";
        var payload = new ImportPreviewRequest(
            "rides.csv",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(csv))
        );

        var response = await PostAsAuthAsync(host.Client, "/api/imports/preview", payload, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(body);
        Assert.Equal(2, body.TotalRows);
        Assert.Equal(1, body.ValidRows);
        Assert.Equal(1, body.InvalidRows);
        Assert.Equal(2, body.Rows.Count);
    }

    [Fact]
    public async Task PostPreview_WithMissingRequiredHeader_ReturnsBadRequest()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var csv = "Time,Temp\n45,60";
        var payload = new ImportPreviewRequest(
            "rides.csv",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(csv))
        );

        var response = await PostAsAuthAsync(host.Client, "/api/imports/preview", payload, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostPreview_WithNonCsvFileName_ReturnsBadRequest()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var payload = new ImportPreviewRequest(
            "rides.pdf",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Date,Miles\n2026-04-01,10"))
        );

        var response = await PostAsAuthAsync(host.Client, "/api/imports/preview", payload, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostPreview_WithFileLargerThanFiveMb_ReturnsBadRequest()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var tooLargeBytes = new byte[(5 * 1024 * 1024) + 1];
        var payload = new ImportPreviewRequest("rides.csv", Convert.ToBase64String(tooLargeBytes));

        var response = await PostAsAuthAsync(host.Client, "/api/imports/preview", payload, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostStart_WhenAnotherImportIsProcessingForSameRider_ReturnsConflict()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var csv = "Date,Miles,Time,Temp,Tags,Notes\n2026-04-01,12.5,45,60,commute,morning";
        var previewPayload = new ImportPreviewRequest(
            "rides.csv",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(csv))
        );

        var firstPreviewResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/preview",
            previewPayload,
            userId
        );
        Assert.Equal(HttpStatusCode.OK, firstPreviewResponse.StatusCode);
        var firstPreviewBody =
            await firstPreviewResponse.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(firstPreviewBody);

        var firstStartPayload = new ImportStartRequest(
            ImportJobId: firstPreviewBody.ImportJobId,
            OverrideAllDuplicates: false,
            Resolutions: []
        );
        var firstStartResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/start",
            firstStartPayload,
            userId
        );
        Assert.Equal(HttpStatusCode.Accepted, firstStartResponse.StatusCode);

        var secondPreviewResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/preview",
            previewPayload,
            userId
        );
        Assert.Equal(HttpStatusCode.OK, secondPreviewResponse.StatusCode);
        var secondPreviewBody =
            await secondPreviewResponse.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(secondPreviewBody);

        var payload = new ImportStartRequest(
            ImportJobId: secondPreviewBody.ImportJobId,
            OverrideAllDuplicates: false,
            Resolutions: []
        );

        var response = await PostAsAuthAsync(host.Client, "/api/imports/start", payload, userId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("CONFLICT", error.Code);
        Assert.Contains("already in progress", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PostPreview_WithDateMilesDuplicate_ReturnsDuplicateDetails()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        await host.SeedRideAsync(userId, new DateTime(2026, 4, 1, 8, 0, 0), 12.5m);

        var payload = new ImportPreviewRequest(
            "rides.csv",
            Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes("Date,Miles,Time\n2026-04-01,12.5,45")
            )
        );

        var response = await PostAsAuthAsync(host.Client, "/api/imports/preview", payload, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body.DuplicateRows);
        Assert.True(body.RequiresDuplicateResolution);
        Assert.Single(body.Rows[0].DuplicateMatches);
    }

    [Fact]
    public async Task PostStart_WithUnresolvedDuplicatesAndNoOverride_ReturnsBadRequest()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        await host.SeedRideAsync(userId, new DateTime(2026, 4, 1, 8, 0, 0), 12.5m);

        var previewPayload = new ImportPreviewRequest(
            "rides.csv",
            Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes("Date,Miles,Time\n2026-04-01,12.5,45")
            )
        );

        var previewResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/preview",
            previewPayload,
            userId
        );
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var previewBody = await previewResponse.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(previewBody);

        var startPayload = new ImportStartRequest(previewBody.ImportJobId, false, []);
        var startResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/start",
            startPayload,
            userId
        );

        Assert.Equal(HttpStatusCode.BadRequest, startResponse.StatusCode);
    }

    [Fact]
    public async Task GetStatus_AfterStart_ReturnsProcessingState()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var previewBody = await PreviewSingleValidRowAsync(host.Client, userId);

        var startResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/start",
            new ImportStartRequest(previewBody.ImportJobId, false, []),
            userId
        );
        Assert.Equal(HttpStatusCode.Accepted, startResponse.StatusCode);

        var statusResponse = await GetAsAuthAsync(
            host.Client,
            $"/api/imports/{previewBody.ImportJobId}/status",
            userId
        );

        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var statusBody = await statusResponse.Content.ReadFromJsonAsync<ImportStatusResponse>();
        Assert.NotNull(statusBody);
        Assert.Equal("processing", statusBody.Status);
        Assert.Equal(1, statusBody.TotalRows);
        Assert.Equal(0, statusBody.ProcessedRows);
        Assert.Equal(0, statusBody.PercentComplete);
    }

    [Fact]
    public async Task PostCancel_WhenProcessing_ReturnsCancelledSummary()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var previewBody = await PreviewSingleValidRowAsync(host.Client, userId);

        var startResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/start",
            new ImportStartRequest(previewBody.ImportJobId, false, []),
            userId
        );
        Assert.Equal(HttpStatusCode.Accepted, startResponse.StatusCode);

        var cancelResponse = await PostAsAuthAsync(
            host.Client,
            $"/api/imports/{previewBody.ImportJobId}/cancel",
            new { },
            userId
        );

        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
        var cancelBody = await cancelResponse.Content.ReadFromJsonAsync<ImportCancelResponse>();
        Assert.NotNull(cancelBody);
        Assert.Equal("cancelled", cancelBody.Status);
        Assert.Equal(0, cancelBody.ProcessedRows);
        Assert.NotEqual(default, cancelBody.CancelledAtUtc);
    }

    [Fact]
    public async Task PostCancel_WhenAlreadyCancelled_IsIdempotent()
    {
        await using var host = await ImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("ImportUser");
        var previewBody = await PreviewSingleValidRowAsync(host.Client, userId);

        var startResponse = await PostAsAuthAsync(
            host.Client,
            "/api/imports/start",
            new ImportStartRequest(previewBody.ImportJobId, false, []),
            userId
        );
        Assert.Equal(HttpStatusCode.Accepted, startResponse.StatusCode);

        var firstCancelResponse = await PostAsAuthAsync(
            host.Client,
            $"/api/imports/{previewBody.ImportJobId}/cancel",
            new { },
            userId
        );
        Assert.Equal(HttpStatusCode.OK, firstCancelResponse.StatusCode);
        var firstCancelBody =
            await firstCancelResponse.Content.ReadFromJsonAsync<ImportCancelResponse>();
        Assert.NotNull(firstCancelBody);

        var secondCancelResponse = await PostAsAuthAsync(
            host.Client,
            $"/api/imports/{previewBody.ImportJobId}/cancel",
            new { },
            userId
        );

        Assert.Equal(HttpStatusCode.OK, secondCancelResponse.StatusCode);
        var secondCancelBody =
            await secondCancelResponse.Content.ReadFromJsonAsync<ImportCancelResponse>();
        Assert.NotNull(secondCancelBody);
        Assert.Equal("cancelled", secondCancelBody.Status);
        Assert.Equal(firstCancelBody.CancelledAtUtc, secondCancelBody.CancelledAtUtc);
    }

    private static async Task<ImportPreviewResponse> PreviewSingleValidRowAsync(
        HttpClient client,
        long userId
    )
    {
        var previewResponse = await PostAsAuthAsync(
            client,
            "/api/imports/preview",
            new ImportPreviewRequest(
                "rides.csv",
                Convert.ToBase64String(
                    System.Text.Encoding.UTF8.GetBytes(
                        "Date,Miles,Time,Temp,Tags,Notes\n2026-04-01,12.5,45,60,commute,morning"
                    )
                )
            ),
            userId
        );
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var previewBody = await previewResponse.Content.ReadFromJsonAsync<ImportPreviewResponse>();
        Assert.NotNull(previewBody);
        return previewBody;
    }

    private static async Task<HttpResponseMessage> GetAsAuthAsync(
        HttpClient client,
        string uri,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostAsAuthAsync<TPayload>(
        HttpClient client,
        string uri,
        TPayload payload,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    private sealed class ImportApiHost(WebApplication app) : IAsyncDisposable
    {
        private readonly WebApplication _app = app;

        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<ImportApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            var dbName = Guid.NewGuid().ToString();

            builder
                .Services.AddAuthentication(UserIdHeaderAuthenticationHandler.SchemeName)
                .AddScheme<
                    UserIdHeaderAuthenticationSchemeOptions,
                    UserIdHeaderAuthenticationHandler
                >(UserIdHeaderAuthenticationHandler.SchemeName, _ => { });
            builder.Services.AddAuthorization();

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(dbName)
            );
            builder.Services.AddScoped<IDuplicateResolutionService, DuplicateResolutionService>();
            builder.Services.AddScoped<IImportJobRepository, EfImportJobRepository>();
            builder.Services.AddScoped<ICsvRideImportService, CsvRideImportService>();
            builder.Services.AddScoped<IImportProgressNotifier, ImportProgressNotifier>();
            builder.Services.AddSingleton<IImportJobProcessor, ImportJobProcessor>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapImportEndpoints();
            await app.StartAsync();

            return new ImportApiHost(app);
        }

        public async Task<long> SeedUserAsync(string name)
        {
            await using var scope = _app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            var user = new UserEntity
            {
                DisplayName = name,
                NormalizedName = name.Trim().ToUpperInvariant(),
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true,
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user.UserId;
        }

        public async Task SeedRideAsync(long riderId, DateTime rideDateTimeLocal, decimal miles)
        {
            await using var scope = _app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            db.Rides.Add(
                new BikeTracking.Api.Infrastructure.Persistence.Entities.RideEntity
                {
                    RiderId = riderId,
                    RideDateTimeLocal = rideDateTimeLocal,
                    Miles = miles,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
            await db.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }
}
