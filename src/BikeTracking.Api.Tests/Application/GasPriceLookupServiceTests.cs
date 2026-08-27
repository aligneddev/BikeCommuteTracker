using System.Collections.Concurrent;
using System.Net;
using System.Text;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Application;

public sealed class GasPriceLookupServiceTests
{
    [Fact]
    public async Task GetOrFetchAsync_RegularAndPremiumForSameWeek_UseIndependentCacheRows()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
        }

        var handler = new StubHandler(request =>
        {
            var isRegular = request.RequestUri?.Query.Contains("facets[product][]=EPMR") == true;
            var value = isRegular ? "3.111" : "3.999";

            return JsonResponse(
                $"{{\"response\":{{\"data\":[{{\"period\":\"2026-03-30\",\"value\":\"{value}\"}}]}}}}"
            );
        });

        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = CreateConfig();
        var timeProvider = new FakeTimeProvider(
            new DateTimeOffset(2026, 4, 1, 12, 0, 0, TimeSpan.Zero)
        );
        var coordinator = new GasPriceRefreshCoordinator();

        await using var context = CreateSqliteContext(connection);
        var service = CreateService(context, factory, config, coordinator, timeProvider);

        var date = new DateOnly(2026, 3, 31);
        var weekStart = new DateOnly(2026, 3, 29);

        var regular = await service.GetOrFetchAsync(date, weekStart, "Regular");
        var premium = await service.GetOrFetchAsync(date, weekStart, "Premium");

        Assert.Equal(3.111m, regular);
        Assert.Equal(3.999m, premium);

        var rows = await context
            .GasPriceLookups.AsNoTracking()
            .Where(x => x.WeekStartDate == weekStart)
            .OrderBy(x => x.Grade)
            .ToListAsync();

        Assert.Equal(2, rows.Count);
        Assert.Collection(
            rows,
            row =>
            {
                Assert.Equal("Premium", row.Grade);
                Assert.Equal(3.999m, row.PricePerGallon);
            },
            row =>
            {
                Assert.Equal("Regular", row.Grade);
                Assert.Equal(3.111m, row.PricePerGallon);
            }
        );
    }

    [Fact]
    public async Task GetOrFetchAsync_UsesEpmrForRegularAndEpmpForPremium()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
        }

        var requestedUris = new List<Uri>();
        var handler = new StubHandler(request =>
        {
            if (request.RequestUri is not null)
            {
                requestedUris.Add(request.RequestUri);
            }

            return JsonResponse(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.555"}]}}
                """
            );
        });

        var service = CreateService(
            CreateSqliteContext(connection),
            new StubHttpClientFactory(
                new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
            ),
            CreateConfig(),
            new GasPriceRefreshCoordinator(),
            new FakeTimeProvider(new DateTimeOffset(2026, 4, 1, 12, 0, 0, TimeSpan.Zero))
        );

        var date = new DateOnly(2026, 3, 31);
        var weekStart = new DateOnly(2026, 3, 29);
        _ = await service.GetOrFetchAsync(date, weekStart, "Regular");
        _ = await service.GetOrFetchAsync(date, weekStart, "Premium");

        Assert.Equal(2, requestedUris.Count);
        Assert.Contains(requestedUris, uri => uri.Query.Contains("facets[product][]=EPMR"));
        Assert.Contains(requestedUris, uri => uri.Query.Contains("facets[product][]=EPMP"));
        Assert.DoesNotContain(requestedUris, uri => uri.Query.Contains("facets[product][]=EPM0"));
    }

    [Fact]
    public async Task GetOrFetchAsync_LegacyNullGradeRow_IsIgnoredAndNewGradedRowIsWritten()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var weekStart = new DateOnly(2026, 3, 29);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.GasPriceLookups.Add(
                new GasPriceLookupEntity
                {
                    PriceDate = new DateOnly(2026, 3, 31),
                    WeekStartDate = weekStart,
                    Grade = null,
                    PricePerGallon = 1.999m,
                    DataSource = "EIA_EPM0_NUS_Weekly",
                    EiaPeriodDate = new DateOnly(2026, 3, 30),
                    RetrievedAtUtc = DateTime.UtcNow,
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ =>
            JsonResponse(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.444"}]}}
                """
            )
        );
        await using var context = CreateSqliteContext(connection);
        var service = CreateService(
            context,
            new StubHttpClientFactory(
                new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
            ),
            CreateConfig(),
            new GasPriceRefreshCoordinator(),
            new FakeTimeProvider(new DateTimeOffset(2026, 4, 1, 12, 0, 0, TimeSpan.Zero))
        );

        var value = await service.GetOrFetchAsync(new DateOnly(2026, 3, 31), weekStart, "Regular");

        Assert.Equal(3.444m, value);
        Assert.Equal(1, handler.CallCount);

        var rows = await context
            .GasPriceLookups.AsNoTracking()
            .Where(x => x.WeekStartDate == weekStart)
            .OrderBy(x => x.GasPriceLookupId)
            .ToListAsync();

        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, row => row.Grade is null && row.PricePerGallon == 1.999m);
        Assert.Contains(rows, row => row.Grade == "Regular" && row.PricePerGallon == 3.444m);
    }

    [Fact]
    public async Task GetOrFetchAsync_FreshEntryYoungerThanThreeDays_ReusesCacheWithoutHttp()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var fixedNow = new DateTimeOffset(2026, 4, 4, 12, 0, 0, TimeSpan.Zero);
        var weekStart = new DateOnly(2026, 3, 29);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.GasPriceLookups.Add(
                new GasPriceLookupEntity
                {
                    PriceDate = new DateOnly(2026, 3, 31),
                    WeekStartDate = weekStart,
                    Grade = "Premium",
                    PricePerGallon = 3.888m,
                    DataSource = "EIA_EPMP_NUS_Weekly",
                    EiaPeriodDate = new DateOnly(2026, 3, 30),
                    RetrievedAtUtc = fixedNow.UtcDateTime.AddDays(-2),
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ => JsonResponse("{}"));
        await using var context = CreateSqliteContext(connection);
        var service = CreateService(
            context,
            new StubHttpClientFactory(
                new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
            ),
            CreateConfig(),
            new GasPriceRefreshCoordinator(),
            new FakeTimeProvider(fixedNow)
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 4, 2), weekStart, "Premium");

        Assert.Equal(3.888m, result);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_StaleEntryAtOrBeyondThreeDays_RefreshesAndReplacesEntry()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var fixedNow = new DateTimeOffset(2026, 4, 4, 12, 0, 0, TimeSpan.Zero);
        var weekStart = new DateOnly(2026, 3, 29);
        int entryId;

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            var entry = new GasPriceLookupEntity
            {
                PriceDate = new DateOnly(2026, 3, 31),
                WeekStartDate = weekStart,
                Grade = "Regular",
                PricePerGallon = 2.999m,
                DataSource = "EIA_EPMR_NUS_Weekly",
                EiaPeriodDate = new DateOnly(2026, 3, 30),
                RetrievedAtUtc = fixedNow.UtcDateTime.AddDays(-4),
            };
            setupContext.GasPriceLookups.Add(entry);
            await setupContext.SaveChangesAsync();
            entryId = entry.GasPriceLookupId;
        }

        var handler = new StubHandler(_ =>
            JsonResponse(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.333"}]}}
                """
            )
        );
        await using var context = CreateSqliteContext(connection);
        var service = CreateService(
            context,
            new StubHttpClientFactory(
                new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
            ),
            CreateConfig(),
            new GasPriceRefreshCoordinator(),
            new FakeTimeProvider(fixedNow)
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 4, 2), weekStart, "Regular");

        Assert.Equal(3.333m, result);
        Assert.Equal(1, handler.CallCount);

        var updated = await context
            .GasPriceLookups.AsNoTracking()
            .SingleAsync(x => x.GasPriceLookupId == entryId);

        Assert.Equal("Regular", updated.Grade);
        Assert.Equal(3.333m, updated.PricePerGallon);
        Assert.Equal(fixedNow.UtcDateTime, updated.RetrievedAtUtc);
    }

    [Fact]
    public async Task GetOrFetchAsync_StaleRefreshFailure_ReturnsPreviousStaleValueWithoutOverwrite()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var fixedNow = new DateTimeOffset(2026, 4, 4, 12, 0, 0, TimeSpan.Zero);
        var weekStart = new DateOnly(2026, 3, 29);
        int entryId;
        var originalRetrievedAt = fixedNow.UtcDateTime.AddDays(-5);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            var entry = new GasPriceLookupEntity
            {
                PriceDate = new DateOnly(2026, 3, 31),
                WeekStartDate = weekStart,
                Grade = "Premium",
                PricePerGallon = 3.777m,
                DataSource = "EIA_EPMP_NUS_Weekly",
                EiaPeriodDate = new DateOnly(2026, 3, 30),
                RetrievedAtUtc = originalRetrievedAt,
            };
            setupContext.GasPriceLookups.Add(entry);
            await setupContext.SaveChangesAsync();
            entryId = entry.GasPriceLookupId;
        }

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        await using var context = CreateSqliteContext(connection);
        var service = CreateService(
            context,
            new StubHttpClientFactory(
                new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
            ),
            CreateConfig(),
            new GasPriceRefreshCoordinator(),
            new FakeTimeProvider(fixedNow)
        );

        var result = await service.GetOrFetchAsync(new DateOnly(2026, 4, 2), weekStart, "Premium");

        Assert.Equal(3.777m, result);
        Assert.Equal(1, handler.CallCount);

        var unchanged = await context
            .GasPriceLookups.AsNoTracking()
            .SingleAsync(x => x.GasPriceLookupId == entryId);

        Assert.Equal(3.777m, unchanged.PricePerGallon);
        Assert.Equal(originalRetrievedAt, unchanged.RetrievedAtUtc);
    }

    [Fact]
    public async Task GetOrFetchAsync_ConcurrentStaleCalls_DeduplicateExternalFetchPerWeekAndGrade()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var fixedNow = new DateTimeOffset(2026, 4, 4, 12, 0, 0, TimeSpan.Zero);
        var weekStart = new DateOnly(2026, 3, 29);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.GasPriceLookups.Add(
                new GasPriceLookupEntity
                {
                    PriceDate = new DateOnly(2026, 3, 31),
                    WeekStartDate = weekStart,
                    Grade = "Regular",
                    PricePerGallon = 2.999m,
                    DataSource = "EIA_EPMR_NUS_Weekly",
                    EiaPeriodDate = new DateOnly(2026, 3, 30),
                    RetrievedAtUtc = fixedNow.UtcDateTime.AddDays(-4),
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ =>
        {
            Thread.Sleep(75);
            return JsonResponse(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.222"}]}}
                """
            );
        });
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = CreateConfig();
        var timeProvider = new FakeTimeProvider(fixedNow);
        var coordinator = new GasPriceRefreshCoordinator();

        var callers = Enumerable
            .Range(0, 5)
            .Select(async _ =>
            {
                await using var context = CreateSqliteContext(connection);
                var service = CreateService(context, factory, config, coordinator, timeProvider);
                return await service.GetOrFetchAsync(
                    new DateOnly(2026, 4, 2),
                    weekStart,
                    "Regular"
                );
            });

        var results = await Task.WhenAll(callers);

        Assert.All(results, result => Assert.Equal(3.222m, result));
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_UsesInjectedTimeProviderBoundaryAcrossServiceRestart()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var initialNow = new DateTimeOffset(2026, 4, 4, 12, 0, 0, TimeSpan.Zero);
        var weekStart = new DateOnly(2026, 3, 29);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.GasPriceLookups.Add(
                new GasPriceLookupEntity
                {
                    PriceDate = new DateOnly(2026, 3, 31),
                    WeekStartDate = weekStart,
                    Grade = "Premium",
                    PricePerGallon = 3.555m,
                    DataSource = "EIA_EPMP_NUS_Weekly",
                    EiaPeriodDate = new DateOnly(2026, 3, 30),
                    RetrievedAtUtc = initialNow.UtcDateTime.AddDays(-2),
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ =>
            JsonResponse(
                """
                {"response":{"data":[{"period":"2026-03-30","value":"3.666"}]}}
                """
            )
        );
        var factory = new StubHttpClientFactory(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.eia.gov") }
        );
        var config = CreateConfig();
        var coordinator = new GasPriceRefreshCoordinator();

        var firstClock = new FakeTimeProvider(initialNow);
        await using (var firstContext = CreateSqliteContext(connection))
        {
            var firstService = CreateService(firstContext, factory, config, coordinator, firstClock);
            var firstResult = await firstService.GetOrFetchAsync(
                new DateOnly(2026, 4, 2),
                weekStart,
                "Premium"
            );
            Assert.Equal(3.555m, firstResult);
        }

        Assert.Equal(0, handler.CallCount);

        var secondClock = new FakeTimeProvider(initialNow.AddDays(2));
        await using (var secondContext = CreateSqliteContext(connection))
        {
            var secondService = CreateService(
                secondContext,
                factory,
                config,
                coordinator,
                secondClock
            );
            var secondResult = await secondService.GetOrFetchAsync(
                new DateOnly(2026, 4, 2),
                weekStart,
                "Premium"
            );
            Assert.Equal(3.666m, secondResult);
        }

        Assert.Equal(1, handler.CallCount);
    }

    private static IConfiguration CreateConfig()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["GasPriceLookup:EiaApiKey"] = "fake-key" }
            )
            .Build();
    }

    private static EiaGasPriceLookupService CreateService(
        BikeTrackingDbContext context,
        IHttpClientFactory factory,
        IConfiguration config,
        GasPriceRefreshCoordinator coordinator,
        TimeProvider timeProvider
    )
    {
        return new EiaGasPriceLookupService(
            context,
            factory,
            config,
            NullLogger<EiaGasPriceLookupService>.Instance,
            coordinator,
            timeProvider
        );
    }

    private static HttpResponseMessage JsonResponse(string json)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
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
        private int _callCount;
        public int CallCount => _callCount;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            Interlocked.Increment(ref _callCount);
            return Task.FromResult(handler(request));
        }
    }
}
