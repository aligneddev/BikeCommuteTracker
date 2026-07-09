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
    [Fact]
    public async Task EditRideService_WithValidRequest_UpdatesRideVersion()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Kara",
            NormalizedName = "kara",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        var ride = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = DateTime.Now.AddHours(-1),
            Miles = 9.5m,
            RideMinutes = 40,
            Temperature = 64m,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<EditRideService>();
        var service = new EditRideService(context, new StubWeatherLookupService(), logger);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 12m,
            RideMinutes: 48,
            Temperature: 66m,
            ExpectedVersion: 1
        );

        var result = await service.ExecuteAsync(user.UserId, ride.Id, request);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Response);

        Assert.Equal(ride.Id, result.Response!.RideId);
        Assert.Equal(2, result.Response.NewVersion);

        var updatedRide = await context.Rides.SingleAsync(r => r.Id == ride.Id);
        Assert.Equal(12m, updatedRide.Miles);
        Assert.Equal(48, updatedRide.RideMinutes);
        Assert.Equal(66m, updatedRide.Temperature);
        Assert.Equal(2, updatedRide.Version);
    }

    [Fact]
    public async Task GetRideHistoryService_RecalculatesSummariesAfterRideEdit()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Lena",
            NormalizedName = "lena",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        var rideDate = DateTime.Now.Date.AddHours(8);
        var ride = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = rideDate,
            Miles = 5m,
            RideMinutes = 30,
            Temperature = 60m,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var historyService = new GetRideHistoryService(context, TimeProvider.System);
        var beforeEdit = await historyService.GetRideHistoryAsync(user.UserId, null, null);
        Assert.Equal(5m, beforeEdit.Summaries.AllTime.Miles);
        Assert.Equal(5m, beforeEdit.FilteredTotal.Miles);

        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var editLogger = loggerFactory.CreateLogger<EditRideService>();
        var editService = new EditRideService(context, new StubWeatherLookupService(), editLogger);

        var editResult = await editService.ExecuteAsync(
            user.UserId,
            ride.Id,
            new EditRideRequest(
                RideDateTimeLocal: rideDate,
                Miles: 9.5m,
                RideMinutes: 34,
                Temperature: 62m,
                ExpectedVersion: 1
            )
        );

        Assert.True(editResult.IsSuccess);

        var afterEdit = await historyService.GetRideHistoryAsync(user.UserId, null, null);
        Assert.Equal(9.5m, afterEdit.Summaries.AllTime.Miles);
        Assert.Equal(9.5m, afterEdit.Summaries.ThisMonth.Miles);
        Assert.Equal(9.5m, afterEdit.FilteredTotal.Miles);
        Assert.Single(afterEdit.Rides);
        Assert.Equal(9.5m, afterEdit.Rides[0].Miles);
    }

    [Fact]
    public async Task RecordRideService_WhenUserSuppliesWeather_UsesUserValuesOverFetchedData()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Mina",
            NormalizedName = "mina",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = user.UserId,
                Latitude = 40.71m,
                Longitude = -74.01m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var weatherLookup = new TrackingWeatherLookupService(
            new WeatherData(72m, 15m, 320, 55, 80, "rain")
        );
        var service = new RecordRideService(
            context,
            weatherLookup,
            NullLogger<RecordRideService>.Instance
        );

        var (_, payload) = await service.ExecuteAsync(
            user.UserId,
            new RecordRideRequest(
                RideDateTimeLocal: DateTime.Now,
                Miles: 10m,
                RideMinutes: 35,
                Temperature: 66m,
                WindSpeedMph: 9m,
                WindDirectionDeg: 260,
                RelativeHumidityPercent: 60,
                CloudCoverPercent: 45,
                PrecipitationType: "snow",
                WeatherUserOverridden: false
            )
        );

        var persistedRide = await context.Rides.OrderByDescending(r => r.Id).FirstAsync();
        Assert.Equal(1, weatherLookup.CallCount);
        Assert.Equal(66m, persistedRide.Temperature);
        Assert.Equal(9m, persistedRide.WindSpeedMph);
        Assert.Equal(260, persistedRide.WindDirectionDeg);
        Assert.Equal(60, persistedRide.RelativeHumidityPercent);
        Assert.Equal(45, persistedRide.CloudCoverPercent);
        Assert.Equal("snow", persistedRide.PrecipitationType);
        Assert.False(persistedRide.WeatherUserOverridden);

        Assert.Equal(66m, payload.Temperature);
        Assert.Equal(9m, payload.WindSpeedMph);
        Assert.Equal(260, payload.WindDirectionDeg);
        Assert.Equal("snow", payload.PrecipitationType);
    }

    [Fact]
    public async Task EditRideService_WhenTimestampUnchanged_DoesNotRefetchWeather()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Nora",
            NormalizedName = "nora",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var originalDate = DateTime.Now.AddHours(-2);
        var ride = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = originalDate,
            Miles = 12m,
            RideMinutes = 40,
            Temperature = 61m,
            WindSpeedMph = 8m,
            WindDirectionDeg = 250,
            RelativeHumidityPercent = 63,
            CloudCoverPercent = 30,
            PrecipitationType = "rain",
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var weatherLookup = new TrackingWeatherLookupService(
            new WeatherData(80m, 20m, 300, 45, 10, "snow")
        );
        var service = new EditRideService(
            context,
            weatherLookup,
            NullLogger<EditRideService>.Instance
        );

        var result = await service.ExecuteAsync(
            user.UserId,
            ride.Id,
            new EditRideRequest(
                RideDateTimeLocal: originalDate,
                Miles: 12.2m,
                RideMinutes: 41,
                Temperature: null,
                ExpectedVersion: 1,
                WindSpeedMph: null,
                WindDirectionDeg: null,
                RelativeHumidityPercent: null,
                CloudCoverPercent: null,
                PrecipitationType: null,
                WeatherUserOverridden: false
            )
        );

        Assert.True(result.IsSuccess);
        Assert.Equal(0, weatherLookup.CallCount);

        var persistedRide = await context.Rides.SingleAsync(r => r.Id == ride.Id);
        Assert.Equal(61m, persistedRide.Temperature);
        Assert.Equal(8m, persistedRide.WindSpeedMph);
        Assert.Equal(250, persistedRide.WindDirectionDeg);
        Assert.Equal("rain", persistedRide.PrecipitationType);
    }

    [Fact]
    public async Task EditRideService_RefreshesSnapshotFields_FromCurrentSettings()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Snapshot Edit Rider",
            NormalizedName = "snapshot edit rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = user.UserId,
                AverageCarMpg = 32m,
                MileageRateCents = 65m,
                YearlyGoalMiles = 1800m,
                OilChangePrice = 70m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = DateTime.Now.AddDays(-1),
            Miles = 8m,
            RideMinutes = 28,
            GasPricePerGallon = 3.49m,
            SnapshotAverageCarMpg = 25m,
            SnapshotMileageRateCents = 50m,
            SnapshotYearlyGoalMiles = 1200m,
            SnapshotOilChangePrice = 55m,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var service = new EditRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<EditRideService>.Instance
        );

        var result = await service.ExecuteAsync(
            user.UserId,
            ride.Id,
            new EditRideRequest(
                RideDateTimeLocal: ride.RideDateTimeLocal,
                Miles: 9m,
                RideMinutes: 31,
                Temperature: 60m,
                GasPricePerGallon: 3.59m,
                ExpectedVersion: 1
            )
        );

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.EventPayload);

        var updatedRide = await context.Rides.SingleAsync(entity => entity.Id == ride.Id);
        Assert.Equal(32m, updatedRide.SnapshotAverageCarMpg);
        Assert.Equal(65m, updatedRide.SnapshotMileageRateCents);
        Assert.Equal(1800m, updatedRide.SnapshotYearlyGoalMiles);
        Assert.Equal(70m, updatedRide.SnapshotOilChangePrice);

        Assert.Equal(32m, result.EventPayload!.SnapshotAverageCarMpg);
        Assert.Equal(65m, result.EventPayload.SnapshotMileageRateCents);
        Assert.Equal(1800m, result.EventPayload.SnapshotYearlyGoalMiles);
        Assert.Equal(70m, result.EventPayload.SnapshotOilChangePrice);
    }
}
