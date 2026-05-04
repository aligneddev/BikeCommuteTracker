using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Application;

public sealed class RidesApplicationServiceTests
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

    [Fact]
    public async Task GetRideDefaultsService_ReturnsDefaultsForNewRider()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Diana",
            NormalizedName = "diana",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideDefaultsService(context);

        var defaults = await service.ExecuteAsync(user.UserId);

        Assert.False(defaults.HasPreviousRide);
        Assert.Null(defaults.DefaultMiles);
        Assert.Null(defaults.DefaultRideMinutes);
        Assert.Null(defaults.DefaultTemperature);
        Assert.NotEqual(DateTime.MinValue, defaults.DefaultRideDateTimeLocal);
    }

    [Fact]
    public async Task GetRideDefaultsService_ReturnsLastRideDefaults()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Eve",
            NormalizedName = "eve",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Create previous ride
        var previousRide = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = DateTime.Now.AddHours(-1),
            Miles = 10.5m,
            RideMinutes = 45,
            Temperature = 72m,
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Rides.Add(previousRide);
        await context.SaveChangesAsync();

        var service = new GetRideDefaultsService(context);

        var defaults = await service.ExecuteAsync(user.UserId);

        Assert.True(defaults.HasPreviousRide);
        Assert.Equal(10.5m, defaults.DefaultMiles);
        Assert.Equal(45, defaults.DefaultRideMinutes);
        Assert.Equal(72m, defaults.DefaultTemperature);
    }

    [Fact]
    public async Task GetRideDefaultsService_ReturnsLatestWeatherDefaults()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Weather Defaults",
            NormalizedName = "weather defaults",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.Rides.Add(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = DateTime.Now.AddMinutes(-10),
                Miles = 4.2m,
                RideMinutes = 15,
                Temperature = 58m,
                WindSpeedMph = 9.1m,
                WindDirectionDeg = 245,
                RelativeHumidityPercent = 67,
                CloudCoverPercent = 30,
                PrecipitationType = "snow",
                WeatherUserOverridden = true,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideDefaultsService(context);
        var defaults = await service.ExecuteAsync(user.UserId);

        Assert.Equal(9.1m, defaults.DefaultWindSpeedMph);
        Assert.Equal(245, defaults.DefaultWindDirectionDeg);
        Assert.Equal(67, defaults.DefaultRelativeHumidityPercent);
        Assert.Equal(30, defaults.DefaultCloudCoverPercent);
        Assert.Equal("snow", defaults.DefaultPrecipitationType);
    }

    // History service tests

    [Fact]
    public async Task GetRideHistoryService_WithRides_ReturnsSummariesAndRows()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Frank",
            NormalizedName = "frank",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        // Add rides with one in prior month so thisMonth assertions stay deterministic.
        var today = DateTime.Now;
        var previousMonth = today.AddMonths(-1);
        context.Rides.AddRange(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = previousMonth,
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = today,
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.NotNull(result);
        Assert.NotNull(result.Summaries);
        Assert.Equal(15m, result.Summaries.AllTime.Miles);
        Assert.Equal(2, result.Summaries.AllTime.RideCount);
        Assert.Equal(5m, result.Summaries.ThisMonth.Miles);
        Assert.Equal(1, result.Summaries.ThisMonth.RideCount);
        Assert.Equal(2, result.Rides.Count);
        Assert.Equal(15m, result.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistoryService_WithoutRides_ReturnsZeroSummaries()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Grace",
            NormalizedName = "grace",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.NotNull(result);
        Assert.Empty(result.Rides);
        Assert.Equal(0, result.TotalRows);
        Assert.Equal(0m, result.Summaries.AllTime.Miles);
        Assert.Equal(0, result.Summaries.AllTime.RideCount);
        Assert.Equal(0m, result.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistoryService_WithDateRangeFilter_ReturnsFilteredRows()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Henry",
            NormalizedName = "henry",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        var today = DateTime.Now;
        var dateOnlyToday = DateOnly.FromDateTime(today);
        var dateOnlyWeekAgo = dateOnlyToday.AddDays(-7);

        context.Rides.AddRange(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = dateOnlyWeekAgo.ToDateTime(TimeOnly.MinValue),
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = today,
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(
            user.UserId,
            dateOnlyToday.AddDays(-1),
            dateOnlyToday
        );

        Assert.Single(result.Rides);
        Assert.Equal(5m, result.FilteredTotal.Miles);
        Assert.Equal(1, result.TotalRows);
    }

    [Fact]
    public async Task GetRideHistoryService_WithInvalidDateRange_Throws()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Ivy",
            NormalizedName = "ivy",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.GetRideHistoryAsync(
                user.UserId,
                DateOnly.FromDateTime(DateTime.Now),
                DateOnly.FromDateTime(DateTime.Now.AddDays(-1))
            )
        );
    }

    [Fact]
    public async Task GetRideHistoryService_WithPageSize_RespectsPagination()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Jack",
            NormalizedName = "jack",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        // Add 5 rides
        for (int i = 0; i < 5; i++)
        {
            context.Rides.Add(
                new RideEntity
                {
                    RiderId = user.UserId,
                    RideDateTimeLocal = DateTime.Now.AddDays(-i),
                    Miles = (i + 1) * 1m,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
        }
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null, pageSize: 2);

        Assert.Equal(2, result.Rides.Count);
        Assert.Equal(1, result.Page);
        Assert.Equal(2, result.PageSize);
        Assert.Equal(5, result.TotalRows);
    }

    [Fact]
    public async Task GetRideHistoryService_WithRideNote_ProjectsNoteInHistoryRow()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Note History",
            NormalizedName = "note history",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        context.Rides.Add(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 6.4m,
                Notes = "Strong crosswind near downtown bridge.",
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);
        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.Single(result.Rides);
        Assert.Equal("Strong crosswind near downtown bridge.", result.Rides[0].Note);
    }

    [Fact]
    public async Task EditRideService_WithValidRequest_UpdatesRideVersionAndQueuesOutboxEvent()
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

        var outboxEvents = await context.OutboxEvents.ToListAsync();
        Assert.Single(outboxEvents);
        Assert.Equal("RideEdited", outboxEvents[0].EventType);
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

        var historyService = new GetRideHistoryService(context);
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
        CancellationToken cancellationToken = default
    )
    {
        CallCount++;
        return Task.FromResult(response);
    }
}
