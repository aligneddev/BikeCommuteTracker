using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Application;

public sealed partial class RidesApplicationServiceTests
{
    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}

internal sealed class StubWeatherLookupService : IWeatherLookupService
{
    public Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<WeatherData?>(null);
}

internal sealed class TrackingWeatherLookupService(WeatherData? response) : IWeatherLookupService
{
    public int CallCount { get; private set; }

    public Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    )
    {
        CallCount++;
        return Task.FromResult(response);
    }
}
