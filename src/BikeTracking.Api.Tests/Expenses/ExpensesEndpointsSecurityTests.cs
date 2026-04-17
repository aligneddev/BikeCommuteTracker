using System.Net;
using BikeTracking.Api.Application.Expenses;
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

    private sealed class SecurityHost(WebApplication app) : IAsyncDisposable
    {
        public HttpClient Client { get; } = app.GetTestClient();

        public static async Task<SecurityHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();

            builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
                options.UseInMemoryDatabase(Guid.NewGuid().ToString())
            );
            builder
                .Services.AddAuthentication("security-test")
                .AddScheme<SecurityAuthSchemeOptions, SecurityAuthHandler>(
                    "security-test",
                    _ => { }
                );
            builder.Services.AddAuthorization();
            builder.Services.AddScoped<RecordExpenseService>();
            builder.Services.AddScoped<IReceiptStorage, SecurityStubReceiptStorage>();

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapExpensesEndpoints();
            await app.StartAsync();

            return new SecurityHost(app);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
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
