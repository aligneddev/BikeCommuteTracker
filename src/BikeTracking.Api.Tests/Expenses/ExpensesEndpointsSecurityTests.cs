using System.Net;
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

public sealed class ExpensesEndpointsSecurityTests
{
    [Fact]
    public async Task PostExpenses_WithoutAuthentication_ReturnsUnauthorized()
    {
        await using var host = await SecurityHost.StartAsync();

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("2026-04-17"), "expenseDate");
        form.Add(new StringContent("12.50"), "amount");

        var response = await host.Client.PostAsync("/api/expenses", form);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetExpenses_WithoutAuthentication_ReturnsUnauthorized()
    {
        await using var host = await SecurityHost.StartAsync();

        var response = await host.Client.GetAsync("/api/expenses");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetExpenses_AsDifferentRider_ExcludesOtherRidersExpenses()
    {
        await using var host = await SecurityHost.StartAsync();
        var ownerId = await host.SeedUserAsync("expense-owner");
        var attackerId = await host.SeedUserAsync("expense-attacker");

        await host.SeedExpenseAsync(
            ownerId,
            new DateTime(2026, 4, 15),
            22.50m,
            "Owner expense",
            null
        );
        var attackerExpenseId = await host.SeedExpenseAsync(
            attackerId,
            new DateTime(2026, 4, 16),
            8.75m,
            "Attacker expense",
            null
        );

        var response = await host.Client.GetWithAuthAsync("/api/expenses", attackerId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ExpenseHistoryResponse>();
        Assert.NotNull(payload);
        Assert.Single(payload.Expenses);
        Assert.Equal(attackerExpenseId, payload.Expenses[0].ExpenseId);
        Assert.DoesNotContain(payload.Expenses, expense => expense.Notes == "Owner expense");
    }

    [Fact]
    public async Task PutExpense_ForDifferentRider_ReturnsNotFound()
    {
        await using var host = await SecurityHost.StartAsync();
        var ownerId = await host.SeedUserAsync("edit-owner");
        var attackerId = await host.SeedUserAsync("edit-attacker");
        var expenseId = await host.SeedExpenseAsync(
            ownerId,
            new DateTime(2026, 4, 17),
            41.20m,
            "Owner edit target",
            null
        );

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/expenses/{expenseId}")
        {
            Content = JsonContent.Create(
                new
                {
                    expenseDate = "2026-04-17",
                    amount = 45.10m,
                    notes = "Attacker update",
                    expectedVersion = 1,
                }
            ),
        };
        request.Headers.Add("X-User-Id", attackerId.ToString());

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteExpense_ForDifferentRider_ReturnsNotFound()
    {
        await using var host = await SecurityHost.StartAsync();
        var ownerId = await host.SeedUserAsync("delete-owner");
        var attackerId = await host.SeedUserAsync("delete-attacker");
        var expenseId = await host.SeedExpenseAsync(
            ownerId,
            new DateTime(2026, 4, 18),
            17.15m,
            "Owner delete target",
            null
        );

        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/expenses/{expenseId}");
        request.Headers.Add("X-User-Id", attackerId.ToString());

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetExpenseReceipt_ForDifferentRider_ReturnsNotFound()
    {
        await using var host = await SecurityHost.StartAsync();
        var ownerId = await host.SeedUserAsync("receipt-owner");
        var attackerId = await host.SeedUserAsync("receipt-attacker");
        var expenseId = await host.SeedExpenseAsync(
            ownerId,
            new DateTime(2026, 4, 19),
            63.40m,
            "Receipt target",
            "1/2/existing-receipt.pdf"
        );

        var response = await host.Client.GetWithAuthAsync(
            $"/api/expenses/{expenseId}/receipt",
            attackerId
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class SecurityHost(WebApplication app) : IAsyncDisposable
    {
        public WebApplication App { get; } = app;

        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<SecurityHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();

            var databaseName = Guid.NewGuid().ToString();

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(databaseName)
            );
            builder
                .Services.AddAuthentication("security-test")
                .AddScheme<SecurityAuthSchemeOptions, SecurityAuthHandler>(
                    "security-test",
                    _ => { }
                );
            builder.Services.AddAuthorization();
            builder.Services.AddScoped<RecordExpenseService>();
            builder.Services.AddScoped<EditExpenseService>();
            builder.Services.AddScoped<DeleteExpenseService>();
            builder.Services.AddScoped<IReceiptStorage, SecurityStubReceiptStorage>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapExpensesEndpoints();
            await app.StartAsync();

            return new SecurityHost(app);
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
            string? receiptPath
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

    private sealed class SecurityStubReceiptStorage : IReceiptStorage
    {
        public Task<string> SaveAsync(
            long riderId,
            long expenseId,
            string filename,
            Stream stream
        ) => Task.FromResult($"{riderId}/{expenseId}/security-stub.bin");

        public Task DeleteAsync(string relativePath) => Task.CompletedTask;

        public Task<Stream> GetAsync(string relativePath) =>
            Task.FromResult<Stream>(new MemoryStream());
    }

    private sealed class SecurityAuthSchemeOptions : AuthenticationSchemeOptions;

    private sealed class SecurityAuthHandler(
        Microsoft.Extensions.Options.IOptionsMonitor<SecurityAuthSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        System.Text.Encodings.Web.UrlEncoder encoder
    ) : AuthenticationHandler<SecurityAuthSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(userIdString))
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
}
