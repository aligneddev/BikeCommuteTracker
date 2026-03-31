using System.Net;
using System.Text;

namespace BikeTracking.Api.Tests.Application;

public sealed class GasPriceLookupServiceTests
{
    [Fact]
    public async Task GetOrFetchAsync_CacheHit_DoesNotCallHttp()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using var context = CreateSqliteContext(connection);
        await context.Database.EnsureCreatedAsync();
        context.GasPriceLookups.Add(
            new GasPriceLookupEntity
            {
                PriceDate = new DateOnly(2026, 3, 31),
                PricePerGallon = 3.1999m,
                DataSource = "EIA_EPM0_NUS_Weekly",
                EiaPeriodDate = new DateOnly(2026, 3, 30),
                RetrievedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        });
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        var service = new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Equal(3.1999m, result);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_CacheMiss_FetchesAndStores()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using var context = CreateSqliteContext(connection);
        await context.Database.EnsureCreatedAsync();

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.125"}]}}
                """,
                Encoding.UTF8,
                "application/json"
            ),
        });

        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        var service = new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Equal(3.125m, result);
        Assert.Equal(1, handler.CallCount);

        var cached = await context.GasPriceLookups.SingleAsync();
        Assert.Equal(new DateOnly(2026, 3, 31), cached.PriceDate);
        Assert.Equal(3.125m, cached.PricePerGallon);
    }

    [Fact]
    public async Task GetOrFetchAsync_OnHttpFailure_ReturnsNullAndDoesNotWrite()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using var context = CreateSqliteContext(connection);
        await context.Database.EnsureCreatedAsync();

        var handler = new StubHandler(_ => new HttpResponseMessage(
            HttpStatusCode.InternalServerError
        ));
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        var service = new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Null(result);
        Assert.Equal(0, await context.GasPriceLookups.CountAsync());
    }

    [Fact]
    public async Task GetOrFetchAsync_SecondCall_UsesCacheAndCallsHttpOnce()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using var context = CreateSqliteContext(connection);
        await context.Database.EnsureCreatedAsync();

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.125"}]}}
                """,
                Encoding.UTF8,
                "application/json"
            ),
        });
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        var service = new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        var first = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));
        var second = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Equal(3.125m, first);
        Assert.Equal(3.125m, second);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_WhenDuplicateDateInsertedConcurrently_ReturnsCachedValue()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
        }

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.125"}]}}
                """,
                Encoding.UTF8,
                "application/json"
            ),
        });
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        await using var context = CreateSqliteContext(connection);
        var service = new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        context.SavingChanges += (_, _) =>
        {
            if (context.GasPriceLookups.Local.Any(x => x.PriceDate == new DateOnly(2026, 3, 31)))
            {
                using var concurrentContext = CreateSqliteContext(connection);
                concurrentContext.GasPriceLookups.Add(
                    new GasPriceLookupEntity
                    {
                        PriceDate = new DateOnly(2026, 3, 31),
                        PricePerGallon = 3.2222m,
                        DataSource = "EIA_EPM0_NUS_Weekly",
                        EiaPeriodDate = new DateOnly(2026, 3, 30),
                        RetrievedAtUtc = DateTime.UtcNow,
                    }
                );
                concurrentContext.SaveChanges();
            }
        };

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Equal(3.2222m, result);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_AfterServiceRestart_UsesPersistedCacheWithoutHttp()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.GasPriceLookups.Add(
                new GasPriceLookupEntity
                {
                    PriceDate = new DateOnly(2026, 3, 31),
                    PricePerGallon = 3.4567m,
                    DataSource = "EIA_EPM0_NUS_Weekly",
                    EiaPeriodDate = new DateOnly(2026, 3, 30),
                    RetrievedAtUtc = DateTime.UtcNow,
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.125"}]}}
                """,
                Encoding.UTF8,
                "application/json"
            ),
        });
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();

        await using var restartedContext = CreateSqliteContext(connection);
        var restartedService = new EiaGasPriceLookupService(
            restartedContext,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance
        );

        var result = await restartedService.GetOrFetchAsync(new DateOnly(2026, 3, 31));

        Assert.Equal(3.4567m, result);
        Assert.Equal(0, handler.CallCount);
    }

    private static BikeTrackingDbContext CreateSqliteContext(SqliteConnection connection)
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseSqlite(connection)
            .Options;

        return new BikeTrackingDbContext(options);
    }

    private sealed class StubHttpClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        : HttpMessageHandler
    {
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            CallCount += 1;
            return Task.FromResult(handler(request));
        }
    }
}
