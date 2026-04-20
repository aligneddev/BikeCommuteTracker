using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Application.ExpenseImports;
using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed class ExpenseImportEndpointsTests
{
    [Fact]
    public async Task PostPreview_WithValidCsv_ReturnsPreviewSummary()
    {
        await using var host = await ExpenseImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-import-preview");

        using var form = BuildCsvForm("expenses.csv", "Date,Amount,Note\n2026-04-01,12.50,Coffee\n2026-04-02,0,Invalid");

        var response = await PostMultipartAsAuthAsync(host.Client, "/api/expense-imports/preview", form, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ExpenseImportPreviewResponse>();
        Assert.NotNull(payload);
        Assert.Equal(2, payload.TotalRows);
        Assert.Equal(1, payload.ValidRows);
        Assert.Equal(1, payload.InvalidRows);
        Assert.Single(payload.Errors);
    }

    [Fact]
    public async Task PostConfirm_WithDuplicateKeepExisting_ReturnsSummaryAndSkipsRow()
    {
        await using var host = await ExpenseImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-import-confirm");
        await host.SeedExpenseAsync(userId, new DateTime(2026, 4, 1), 12.50m, "Original note");

        using var form = BuildCsvForm("expenses.csv", "Date,Amount,Note\n2026-04-01,12.50,Imported note");
        var previewResponse = await PostMultipartAsAuthAsync(host.Client, "/api/expense-imports/preview", form, userId);
        var previewPayload = await previewResponse.Content.ReadFromJsonAsync<ExpenseImportPreviewResponse>();
        Assert.NotNull(previewPayload);

        var confirmResponse = await PostJsonAsAuthAsync(
            host.Client,
            $"/api/expense-imports/{previewPayload.JobId}/confirm",
            new ConfirmExpenseImportRequest(false, []),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        var summary = await confirmResponse.Content.ReadFromJsonAsync<ExpenseImportSummaryResponse>();
        Assert.NotNull(summary);
        Assert.Equal(0, summary.ImportedRows);
        Assert.Equal(1, summary.SkippedRows);
    }

    [Fact]
    public async Task PostConfirm_WithReplaceWithImportAndBlankNote_PreservesExistingNote()
    {
        await using var host = await ExpenseImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-import-replace");
        var expenseId = await host.SeedExpenseAsync(userId, new DateTime(2026, 4, 1), 12.50m, "Keep me");

        using var form = BuildCsvForm("expenses.csv", "Date,Amount,Note\n2026-04-01,12.50,");
        var previewResponse = await PostMultipartAsAuthAsync(host.Client, "/api/expense-imports/preview", form, userId);
        var previewPayload = await previewResponse.Content.ReadFromJsonAsync<ExpenseImportPreviewResponse>();
        Assert.NotNull(previewPayload);

        var confirmResponse = await PostJsonAsAuthAsync(
            host.Client,
            $"/api/expense-imports/{previewPayload.JobId}/confirm",
            new ConfirmExpenseImportRequest(
                false,
                [new ExpenseDuplicateResolutionChoice(1, "replace-with-import")]
            ),
            userId
        );

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        await using var scope = host.App.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var expense = await dbContext.Expenses.SingleAsync(current => current.Id == expenseId);
        Assert.Equal(12.50m, expense.Amount);
        Assert.Equal("Keep me", expense.Notes);
        Assert.Equal(2, expense.Version);
    }

    [Fact]
    public async Task Delete_RemovesJobAndRows()
    {
        await using var host = await ExpenseImportApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-import-delete");

        using var form = BuildCsvForm("expenses.csv", "Date,Amount,Note\n2026-04-01,12.50,Coffee");
        var previewResponse = await PostMultipartAsAuthAsync(host.Client, "/api/expense-imports/preview", form, userId);
        var previewPayload = await previewResponse.Content.ReadFromJsonAsync<ExpenseImportPreviewResponse>();
        Assert.NotNull(previewPayload);

        var deleteResponse = await DeleteAsAuthAsync(host.Client, $"/api/expense-imports/{previewPayload.JobId}", userId);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        await using var scope = host.App.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        Assert.False(await dbContext.ExpenseImportJobs.AnyAsync());
        Assert.False(await dbContext.ExpenseImportRows.AnyAsync());
    }

    private static MultipartFormDataContent BuildCsvForm(string fileName, string csvContent)
    {
        var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(csvContent));
        form.Add(fileContent, "file", fileName);
        return form;
    }

    private static async Task<HttpResponseMessage> PostMultipartAsAuthAsync(
        HttpClient client,
        string uri,
        MultipartFormDataContent form,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, uri) { Content = form };
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostJsonAsAuthAsync<T>(
        HttpClient client,
        string uri,
        T payload,
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

    private static async Task<HttpResponseMessage> DeleteAsAuthAsync(
        HttpClient client,
        string uri,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, uri);
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    private sealed class ExpenseImportApiHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;

        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<ExpenseImportApiHost> StartAsync()
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
            builder.Services.AddScoped<RecordExpenseService>();
            builder.Services.AddScoped<EditExpenseService>();
            builder.Services.AddScoped<CsvExpenseParser>();
            builder.Services.AddScoped<ExpenseDuplicateDetector>();
            builder.Services.AddScoped<CsvExpenseImportService>();
            builder.Services.AddScoped<IReceiptStorage, ExpenseImportStubReceiptStorage>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapExpenseImportEndpoints();
            await app.StartAsync();

            return new ExpenseImportApiHost(app);
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

        public async Task<long> SeedExpenseAsync(long riderId, DateTime expenseDate, decimal amount, string? notes)
        {
            using var scope = App.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var expense = new ExpenseEntity
            {
                RiderId = riderId,
                ExpenseDate = expenseDate,
                Amount = amount,
                Notes = notes,
                IsDeleted = false,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            };

            dbContext.Expenses.Add(expense);
            await dbContext.SaveChangesAsync();
            return expense.Id;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await App.StopAsync();
            await App.DisposeAsync();
        }
    }
}

internal sealed class ExpenseImportStubReceiptStorage : IReceiptStorage
{
    public Task<string> SaveAsync(long riderId, long expenseId, string filename, Stream stream)
    {
        return Task.FromResult($"{riderId}/{expenseId}/stub.bin");
    }

    public Task DeleteAsync(string relativePath)
    {
        return Task.CompletedTask;
    }

    public Task<Stream> GetAsync(string relativePath)
    {
        return Task.FromResult<Stream>(new MemoryStream());
    }
}