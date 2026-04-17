using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class ExpensesEndpointsTests
{
    [Fact]
    public async Task PostExpenses_WithValidExpense_ReturnsCreated()
    {
        await using var host = await ExpensesApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-created");

        using var form = BuildForm("2026-04-17", "49.95", "Chain replacement");

        var response = await host.Client.PostWithAuthMultipartAsync("/api/expenses", form, userId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task PostExpenses_WithInvalidAmount_ReturnsBadRequest()
    {
        await using var host = await ExpensesApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-invalid-amount");

        using var form = BuildForm("2026-04-17", "0", "Should fail");

        var response = await host.Client.PostWithAuthMultipartAsync("/api/expenses", form, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostExpenses_WithInvalidReceipt_ReturnsUnprocessableEntity()
    {
        await using var host = await ExpensesApiHost.StartAsync();
        var userId = await host.SeedUserAsync("expense-invalid-receipt");

        using var form = BuildForm("2026-04-17", "19.99", "With bad receipt");
        var badReceipt = new ByteArrayContent("bad file"u8.ToArray());
        badReceipt.Headers.ContentType = MediaTypeHeaderValue.Parse("text/plain");
        form.Add(badReceipt, "receipt", "receipt.txt");

        var response = await host.Client.PostWithAuthMultipartAsync("/api/expenses", form, userId);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task GetExpenses_ReturnsOnlyCurrentRiderNonDeletedAndTotals()
    {
        await using var host = await ExpensesApiHost.StartAsync();
        var riderA = await host.SeedUserAsync("rider-a");
        var riderB = await host.SeedUserAsync("rider-b");

        await host.SeedExpenseAsync(riderA, new DateTime(2026, 4, 1), 10m, "A1", null, false);
        await host.SeedExpenseAsync(riderA, new DateTime(2026, 4, 2), 20m, "A2", "file.pdf", false);
        await host.SeedExpenseAsync(riderA, new DateTime(2026, 4, 3), 30m, "A3", null, true);
        await host.SeedExpenseAsync(riderB, new DateTime(2026, 4, 2), 99m, "B1", null, false);

        var response = await host.Client.GetWithAuthAsync("/api/expenses", riderA);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ExpenseHistoryResponse>();
        Assert.NotNull(payload);
        Assert.Equal(2, payload.ExpenseCount);
        Assert.Equal(30m, payload.TotalAmount);
        Assert.Equal(2, payload.Expenses.Count);
        Assert.Contains(payload.Expenses, expense => expense.HasReceipt);
    }

    [Fact]
    public async Task GetExpenses_WithDateRange_FiltersResult()
    {
        await using var host = await ExpensesApiHost.StartAsync();
        var riderId = await host.SeedUserAsync("filter-rider");

        await host.SeedExpenseAsync(riderId, new DateTime(2026, 4, 1), 5m, null, null, false);
        await host.SeedExpenseAsync(riderId, new DateTime(2026, 4, 10), 15m, null, null, false);
        await host.SeedExpenseAsync(riderId, new DateTime(2026, 4, 20), 25m, null, null, false);

        var response = await host.Client.GetWithAuthAsync(
            "/api/expenses?startDate=2026-04-05&endDate=2026-04-15",
            riderId
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ExpenseHistoryResponse>();
        Assert.NotNull(payload);
        Assert.Single(payload.Expenses);
        Assert.Equal(15m, payload.TotalAmount);
        Assert.Equal(new DateTime(2026, 4, 10), payload.Expenses[0].ExpenseDate);
    }

    private static MultipartFormDataContent BuildForm(
        string expenseDate,
        string amount,
        string? notes
    )
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(expenseDate), "expenseDate");
        form.Add(new StringContent(amount), "amount");

        if (!string.IsNullOrWhiteSpace(notes))
        {
            form.Add(new StringContent(notes), "notes");
        }

        return form;
    }

    private sealed class ExpensesApiHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;

        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<ExpensesApiHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();

            var databaseName = Guid.NewGuid().ToString();
            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
            );
            builder
                .Services.AddAuthentication("test")
                .AddScheme<ExpensesTestAuthSchemeOptions, ExpensesTestAuthHandler>(
                    "test",
                    _ => { }
                );
            builder.Services.AddAuthorization();
            builder.Services.AddScoped<RecordExpenseService>();
            builder.Services.AddScoped<IReceiptStorage, StubReceiptStorage>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapExpensesEndpoints();
            await app.StartAsync();

            return new ExpensesApiHost(app);
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

        public async Task<long> SeedExpenseAsync(
            long riderId,
            DateTime expenseDate,
            decimal amount,
            string? notes,
            string? receiptPath,
            bool isDeleted
        )
        {
            using var scope = App.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

            var expense = new ExpenseEntity
            {
                RiderId = riderId,
                ExpenseDate = expenseDate,
                Amount = amount,
                Notes = notes,
                ReceiptPath = receiptPath,
                IsDeleted = isDeleted,
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

internal sealed class StubReceiptStorage : IReceiptStorage
{
    public Task<string> SaveAsync(long riderId, long expenseId, string filename, Stream stream) =>
        Task.FromResult($"{riderId}/{expenseId}/stub.bin");

    public Task DeleteAsync(string relativePath) => Task.CompletedTask;

    public Task<Stream> GetAsync(string relativePath) =>
        Task.FromResult<Stream>(new MemoryStream());
}

internal sealed class ExpensesTestAuthSchemeOptions : AuthenticationSchemeOptions;

internal sealed class ExpensesTestAuthHandler(
    Microsoft.Extensions.Options.IOptionsMonitor<ExpensesTestAuthSchemeOptions> options,
    Microsoft.Extensions.Logging.ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder
) : AuthenticationHandler<ExpensesTestAuthSchemeOptions>(options, logger, encoder)
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

internal static class ExpensesHttpClientExtensions
{
    public static async Task<HttpResponseMessage> PostWithAuthMultipartAsync(
        this HttpClient client,
        string requestUri,
        MultipartFormDataContent form,
        long userId
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri) { Content = form };
        request.Headers.Add("X-User-Id", userId.ToString());
        return await client.SendAsync(request);
    }

    public static async Task<HttpResponseMessage> GetWithAuthAsync(
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
