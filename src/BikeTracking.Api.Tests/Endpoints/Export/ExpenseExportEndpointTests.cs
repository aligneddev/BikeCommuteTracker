using System.Net;
using BikeTracking.Api.Application.Export;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Tests.Endpoints.Export;

public sealed class ExpenseExportEndpointTests
{
    // ──────────────────────────────────────────────────────────────────────
    // 200 OK — response headers
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_ReturnsOk()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-ok");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetExpenseExport_ReturnsCorrectContentType()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-content-type");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);

        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
    }

    [Fact]
    public async Task GetExpenseExport_ReturnsCorrectContentDisposition()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-disposition");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition.DispositionType);
        Assert.Equal("expenses-export.csv", disposition.FileName);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Header row
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_FirstLineIsHeaderRow()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-header");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.True(lines.Length >= 1);
        Assert.Equal("Date,Amount,Notes,CreatedAtUtc", lines[0]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Empty dataset — header-only CSV
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_WithNoExpenses_ReturnsHeaderOnly()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-empty");

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Single(lines);
        Assert.Equal("Date,Amount,Notes,CreatedAtUtc", lines[0]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Multi-record export — data rows present
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_WithMultipleExpenses_ReturnsAllDataRows()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-multi");

        await host.SeedExpenseAsync(
            userId,
            new DateTime(2026, 1, 15),
            49.95m,
            "Chain replacement",
            false
        );
        await host.SeedExpenseAsync(userId, new DateTime(2026, 2, 3), 12.00m, null, false);
        await host.SeedExpenseAsync(
            userId,
            new DateTime(2026, 3, 10),
            7.50m,
            "Tyre, inner tube",
            false
        );

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        // header + 3 data rows
        Assert.Equal(4, lines.Length);
    }

    [Fact]
    public async Task GetExpenseExport_DataRowContainsExpectedFields()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-fields");

        await host.SeedExpenseAsync(
            userId,
            new DateTime(2026, 1, 15),
            49.95m,
            "Chain replacement",
            false
        );

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        var dataRow = lines[1];
        Assert.Contains("2026-01-15", dataRow);
        Assert.Contains("49.95", dataRow);
        Assert.Contains("Chain replacement", dataRow);
    }

    // ──────────────────────────────────────────────────────────────────────
    // RFC 4180 quoting of Notes field
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_NotesWithComma_IsRfc4180Quoted()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-quoted");

        await host.SeedExpenseAsync(
            userId,
            new DateTime(2026, 3, 10),
            7.50m,
            "Tyre, inner tube",
            false
        );

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        Assert.Contains("\"Tyre, inner tube\"", lines[1]);
    }

    [Fact]
    public async Task GetExpenseExport_NullNotes_RendersAsBlankCell()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-null-notes");

        await host.SeedExpenseAsync(userId, new DateTime(2026, 2, 3), 12.00m, null, false);

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        // Notes cell is blank — row ends with two commas before CreatedAtUtc or empty Notes cell
        var fields = SplitCsvRow(lines[1]);
        Assert.Equal(string.Empty, fields[2]); // Notes is index 2
    }

    // ──────────────────────────────────────────────────────────────────────
    // User-scoping — no cross-user data
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_ReturnsOnlyAuthenticatedUserExpenses()
    {
        await using var host = await ExportApiHost.StartAsync();
        var riderA = await host.SeedUserAsync("scope-rider-a");
        var riderB = await host.SeedUserAsync("scope-rider-b");

        await host.SeedExpenseAsync(
            riderA,
            new DateTime(2026, 1, 1),
            10m,
            "Rider A expense",
            false
        );
        await host.SeedExpenseAsync(
            riderB,
            new DateTime(2026, 1, 2),
            99m,
            "Rider B expense",
            false
        );

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", riderA);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        // header + 1 row for rider A only
        Assert.Equal(2, lines.Length);
        Assert.Contains("Rider A expense", body);
        Assert.DoesNotContain("Rider B expense", body);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Soft-deleted expenses must be excluded
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_ExcludesSoftDeletedExpenses()
    {
        await using var host = await ExportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("export-deleted");

        await host.SeedExpenseAsync(userId, new DateTime(2026, 1, 1), 10m, "Active expense", false);
        await host.SeedExpenseAsync(userId, new DateTime(2026, 1, 2), 20m, "Deleted expense", true);

        var response = await host.Client.GetWithExportAuthAsync("/api/exports/expenses", userId);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        Assert.Contains("Active expense", body);
        Assert.DoesNotContain("Deleted expense", body);
    }

    // ──────────────────────────────────────────────────────────────────────
    // 401 for missing auth header
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetExpenseExport_WithoutAuthHeader_Returns401()
    {
        await using var host = await ExportApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/exports/expenses");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Naïve CSV row splitter for assertion purposes (handles simple quoted fields).
    /// </summary>
    private static string[] SplitCsvRow(string row)
    {
        var fields = new List<string>();
        var inQuotes = false;
        var current = new System.Text.StringBuilder();

        for (var i = 0; i < row.Length; i++)
        {
            var ch = row[i];

            if (inQuotes)
            {
                if (ch == '"' && i + 1 < row.Length && row[i + 1] == '"')
                {
                    current.Append('"');
                    i++; // skip escaped quote
                }
                else if (ch == '"')
                {
                    inQuotes = false;
                }
                else
                {
                    current.Append(ch);
                }
            }
            else
            {
                if (ch == '"')
                {
                    inQuotes = true;
                }
                else if (ch == ',')
                {
                    fields.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(ch);
                }
            }
        }

        fields.Add(current.ToString());
        return [.. fields];
    }
}

// ──────────────────────────────────────────────────────────────────────
// Test Host and helpers
// ──────────────────────────────────────────────────────────────────────

internal sealed class ExportApiHost(WebApplication app) : IAsyncDisposable
{
    public WebApplication App { get; } = app;
    public HttpClient Client { get; } = app.GetTestClient();

    public static async Task<ExportApiHost> StartAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();

        var databaseName = Guid.NewGuid().ToString();
        builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
            options.UseInMemoryDatabase(databaseName)
        );

        builder
            .Services.AddAuthentication("export-test")
            .AddScheme<ExportTestAuthSchemeOptions, ExportTestAuthHandler>("export-test", _ => { });
        builder.Services.AddAuthorization();

        builder.Services.AddScoped<ExpenseCsvExportService>();
        builder.Services.AddScoped<RideHistoryCsvExportService>();

        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapExportEndpoints();
        await app.StartAsync();

        return new ExportApiHost(app);
    }

    public async Task<long> SeedUserAsync(string displayName)
    {
        using var scope = App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        var user = new UserEntity
        {
            DisplayName = displayName,
            NormalizedName = displayName.ToLowerInvariant(),
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user.UserId;
    }

    public async Task SeedExpenseAsync(
        long riderId,
        DateTime expenseDate,
        decimal amount,
        string? notes,
        bool isDeleted
    )
    {
        using var scope = App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = riderId,
                ExpenseDate = expenseDate,
                Amount = amount,
                Notes = notes,
                IsDeleted = isDeleted,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        await dbContext.SaveChangesAsync();
    }

    public async Task SeedRideAsync(
        long riderId,
        DateTime rideDateTimeLocal,
        decimal miles,
        string? notes = null
    )
    {
        using var scope = App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = riderId,
                RideDateTimeLocal = rideDateTimeLocal,
                Miles = miles,
                Notes = notes,
                WeatherUserOverridden = false,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );

        await dbContext.SaveChangesAsync();
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await App.StopAsync();
        await App.DisposeAsync();
    }
}

internal sealed class ExportTestAuthSchemeOptions : AuthenticationSchemeOptions;

internal sealed class ExportTestAuthHandler(
    IOptionsMonitor<ExportTestAuthSchemeOptions> options,
    Microsoft.Extensions.Logging.ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder
) : AuthenticationHandler<ExportTestAuthSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new[] { new System.Security.Claims.Claim("sub", userIdString) };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, Scheme.Name);
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

internal static class ExportHttpClientExtensions
{
    public static async Task<HttpResponseMessage> GetWithExportAuthAsync(
        this HttpClient client,
        string requestUri,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }
}
