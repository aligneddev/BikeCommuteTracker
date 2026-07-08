using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Application;

public sealed partial class RidesApplicationServiceTests
{
    [Fact]
    public async Task RecordRideService_WithValidRequest_PersistsRideAndCreatesEvent()
    {
        using var context = CreateDbContext();
        // Seed user
        var user = new UserEntity
        {
            DisplayName = "Alice",
            NormalizedName = "alice",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );
        var request = new RecordRideRequest(DateTime.Now, 10.5m, 45, 72m);

        var (rideId, eventPayload) = await service.ExecuteAsync(user.UserId, request);

        Assert.True(rideId > 0);
        Assert.NotNull(eventPayload);
        Assert.Equal(user.UserId, eventPayload.RiderId);
        Assert.Equal(10.5m, eventPayload.Miles);
        Assert.Equal(45, eventPayload.RideMinutes);
        Assert.Equal(72m, eventPayload.Temperature);

        // Verify ride was persisted
        var persistedRide = await context.Rides.FindAsync(rideId);
        Assert.NotNull(persistedRide);
        Assert.Equal(user.UserId, persistedRide.RiderId);
        Assert.Equal(10.5m, persistedRide.Miles);
    }

    [Fact]
    public async Task RecordRideService_WithWeatherFields_PersistsWeatherAndEventPayload()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Weather Rider",
            NormalizedName = "weather rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );
        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 12.5m,
            RideMinutes: 41,
            Temperature: 62m,
            GasPricePerGallon: 3.1999m,
            WindSpeedMph: 7.5m,
            WindDirectionDeg: 250,
            RelativeHumidityPercent: 60,
            CloudCoverPercent: 45,
            PrecipitationType: "rain",
            WeatherUserOverridden: true
        );

        var (rideId, eventPayload) = await service.ExecuteAsync(user.UserId, request);

        var persistedRide = await context.Rides.FindAsync(rideId);
        Assert.NotNull(persistedRide);
        Assert.Equal(7.5m, persistedRide.WindSpeedMph);
        Assert.Equal(250, persistedRide.WindDirectionDeg);
        Assert.Equal(60, persistedRide.RelativeHumidityPercent);
        Assert.Equal(45, persistedRide.CloudCoverPercent);
        Assert.Equal("rain", persistedRide.PrecipitationType);
        Assert.True(persistedRide.WeatherUserOverridden);

        Assert.Equal(7.5m, eventPayload.WindSpeedMph);
        Assert.Equal(250, eventPayload.WindDirectionDeg);
        Assert.Equal(60, eventPayload.RelativeHumidityPercent);
        Assert.Equal(45, eventPayload.CloudCoverPercent);
        Assert.Equal("rain", eventPayload.PrecipitationType);
        Assert.True(eventPayload.WeatherUserOverridden);
    }

    [Fact]
    public async Task RecordRideService_WithValidNote_PersistsRideNoteAndEventPayloadNote()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Notes Rider",
            NormalizedName = "notes rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );

        var note = "Bridge detour this morning.";
        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 8.2m,
            RideMinutes: 32,
            Temperature: 64m,
            Note: note
        );

        var (rideId, eventPayload) = await service.ExecuteAsync(user.UserId, request);

        var persistedRide = await context.Rides.SingleAsync(ride => ride.Id == rideId);
        Assert.Equal(note, persistedRide.Notes);
        Assert.Equal(note, eventPayload.Note);
    }

    [Fact]
    public async Task RecordRideService_WithNoteLongerThanFiveHundredChars_ThrowsArgumentException()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Long Notes Rider",
            NormalizedName = "long notes rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );

        var tooLongNote = new string('n', 501);
        var request = new RecordRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 7.1m,
            RideMinutes: 28,
            Temperature: 60m,
            Note: tooLongNote
        );

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task RecordRideService_CapturesUserSettingsSnapshots_OnRideAndEventPayload()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Snapshot Rider",
            NormalizedName = "snapshot rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = user.UserId,
                AverageCarMpg = 31.5m,
                MileageRateCents = 67m,
                YearlyGoalMiles = 2400m,
                OilChangePrice = 79m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );

        var (rideId, eventPayload) = await service.ExecuteAsync(
            user.UserId,
            new RecordRideRequest(DateTime.Now, 11m, 30, 63m, 3.29m)
        );

        var persistedRide = await context.Rides.SingleAsync(ride => ride.Id == rideId);
        Assert.Equal(31.5m, persistedRide.SnapshotAverageCarMpg);
        Assert.Equal(67m, persistedRide.SnapshotMileageRateCents);
        Assert.Equal(2400m, persistedRide.SnapshotYearlyGoalMiles);
        Assert.Equal(79m, persistedRide.SnapshotOilChangePrice);

        Assert.Equal(31.5m, eventPayload.SnapshotAverageCarMpg);
        Assert.Equal(67m, eventPayload.SnapshotMileageRateCents);
        Assert.Equal(2400m, eventPayload.SnapshotYearlyGoalMiles);
        Assert.Equal(79m, eventPayload.SnapshotOilChangePrice);
    }

    [Fact]
    public async Task RecordRideService_ValidatesMillesGreaterThanZero()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Bob",
            NormalizedName = "bob",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );
        var request = new RecordRideRequest(DateTime.Now, 0m);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task RecordRideService_ValidatesRideMinutesGreaterThanZeroWhenProvided()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Charlie",
            NormalizedName = "charlie",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );
        var request = new RecordRideRequest(DateTime.Now, 10m, -5);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task RecordRideService_ValidatesMilesLessThanOrEqualToTwoHundred()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Cara",
            NormalizedName = "cara",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(
            context,
            new StubWeatherLookupService(),
            NullLogger<RecordRideService>.Instance
        );
        var request = new RecordRideRequest(DateTime.Now, 201m);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }
}
