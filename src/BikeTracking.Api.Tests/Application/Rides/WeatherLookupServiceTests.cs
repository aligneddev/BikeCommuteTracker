using System.Net;
using System.Text;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Application.Rides;

public sealed class WeatherLookupServiceTests
{
    [Fact]
    public void OpenMeteoWeatherLookupService_Type_ShouldExist()
    {
        var type = Type.GetType(
            "BikeTracking.Api.Application.Rides.OpenMeteoWeatherLookupService, BikeTracking.Api"
        );

        Assert.NotNull(type);
    }

    [Fact]
    public void IWeatherLookupService_Interface_ShouldExist()
    {
        var type = Type.GetType(
            "BikeTracking.Api.Application.Rides.IWeatherLookupService, BikeTracking.Api"
        );

        Assert.NotNull(type);
    }

    [Fact]
    public async Task GetOrFetchAsync_CacheHit_DoesNotCallHttp()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        await using var context = CreateSqliteContext(connection);
        await context.Database.EnsureCreatedAsync();

        var lookupHour = new DateTime(2026, 4, 1, 12, 0, 0, DateTimeKind.Utc);
        context.WeatherLookups.Add(
            new WeatherLookupEntity
            {
                LookupHourUtc = lookupHour,
                LatitudeRounded = 40.71m,
                LongitudeRounded = -74.01m,
                Temperature = 63.2m,
                WindSpeedMph = 11.3m,
                WindDirectionDeg = 250,
                RelativeHumidityPercent = 62,
                CloudCoverPercent = 25,
                PrecipitationType = "rain",
                DataSource = "OpenMeteo",
                RetrievedAtUtc = DateTime.UtcNow,
                Status = "success",
            }
        );
        await context.SaveChangesAsync();

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        });
        var factory = new StubHttpClientFactory(new HttpClient(handler));
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var service = new OpenMeteoWeatherLookupService(
            context,
            factory,
            config,
            NullLogger<OpenMeteoWeatherLookupService>.Instance
        );

        var result = await service.GetOrFetchAsync(40.7128m, -74.0060m, lookupHour);

        Assert.NotNull(result);
        Assert.Equal(63.2m, result!.Temperature);
        Assert.Equal(11.3m, result.WindSpeedMph);
        Assert.Equal(0, handler.CallCount);
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
                CreateHourlyResponseJson(),
                Encoding.UTF8,
                "application/json"
            ),
        });

        var factory = new StubHttpClientFactory(new HttpClient(handler));
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var service = new OpenMeteoWeatherLookupService(
            context,
            factory,
            config,
            NullLogger<OpenMeteoWeatherLookupService>.Instance
        );

        var lookupTime = new DateTime(2026, 4, 2, 9, 34, 0, DateTimeKind.Utc);

        var first = await service.GetOrFetchAsync(40.7128m, -74.0060m, lookupTime);
        var second = await service.GetOrFetchAsync(40.7128m, -74.0060m, lookupTime);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.Temperature, second!.Temperature);
        Assert.Equal(1, handler.CallCount);

        var cacheCount = await context.WeatherLookups.CountAsync();
        Assert.Equal(1, cacheCount);
    }

    [Fact]
    public async Task GetOrFetchAsync_AfterServiceRestart_UsesPersistedCacheWithoutHttp()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var lookupHour = new DateTime(2026, 4, 3, 7, 0, 0, DateTimeKind.Utc);

        await using (var setupContext = CreateSqliteContext(connection))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.WeatherLookups.Add(
                new WeatherLookupEntity
                {
                    LookupHourUtc = lookupHour,
                    LatitudeRounded = 37.77m,
                    LongitudeRounded = -122.42m,
                    Temperature = 58.4m,
                    WindSpeedMph = 6.2m,
                    WindDirectionDeg = 210,
                    RelativeHumidityPercent = 70,
                    CloudCoverPercent = 45,
                    PrecipitationType = null,
                    DataSource = "OpenMeteo",
                    RetrievedAtUtc = DateTime.UtcNow,
                    Status = "success",
                }
            );
            await setupContext.SaveChangesAsync();
        }

        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                CreateHourlyResponseJson(),
                Encoding.UTF8,
                "application/json"
            ),
        });
        var factory = new StubHttpClientFactory(new HttpClient(handler));
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        await using var restartedContext = CreateSqliteContext(connection);
        var restartedService = new OpenMeteoWeatherLookupService(
            restartedContext,
            factory,
            config,
            NullLogger<OpenMeteoWeatherLookupService>.Instance
        );

        var result = await restartedService.GetOrFetchAsync(37.7749m, -122.4194m, lookupHour);

        Assert.NotNull(result);
        Assert.Equal(58.4m, result!.Temperature);
        Assert.Equal(6.2m, result.WindSpeedMph);
        Assert.Equal(0, handler.CallCount);
    }

    private static BikeTrackingDbContext CreateSqliteContext(SqliteConnection connection)
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseSqlite(connection)
            .Options;
        return new BikeTrackingDbContext(options);
    }

    private static string CreateHourlyResponseJson()
    {
        return """
            {
              "hourly": {
                "time": ["2026-04-02T09:00"],
                "temperature_2m": [60.5],
                "wind_speed_10m": [9.2],
                "wind_direction_10m": [240],
                "relative_humidity_2m": [57],
                "cloud_cover": [35],
                "precipitation": [0.2],
                "snowfall": [0.0],
                "weather_code": [61]
              }
            }
            """;
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
            CallCount++;
            return Task.FromResult(handler(request));
        }
    }
}
