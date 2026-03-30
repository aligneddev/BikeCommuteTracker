using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Tests.TestSupport;

namespace BikeTracking.Api.Tests.Application.Users;

public sealed class UserSettingsServiceTests
{
    [Fact]
    public async Task SaveAsync_CreatesSettingsProfile_ForFirstSave()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(dbContext, "Settings User A");
        var service = new UserSettingsService(dbContext);

        var result = await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31.5m,
                YearlyGoalMiles: 1800m,
                OilChangePrice: 89.99m,
                MileageRateCents: 67.5m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None
        );

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Response);
        Assert.True(result.Response.HasSettings);

        var loaded = await service.GetAsync(user.UserId, CancellationToken.None);
        Assert.True(loaded.IsSuccess);
        Assert.NotNull(loaded.Response);
        Assert.True(loaded.Response.HasSettings);
        Assert.Equal(31.5m, loaded.Response.Settings.AverageCarMpg);
        Assert.Equal(1800m, loaded.Response.Settings.YearlyGoalMiles);
        Assert.Equal(89.99m, loaded.Response.Settings.OilChangePrice);
        Assert.Equal(67.5m, loaded.Response.Settings.MileageRateCents);
    }

    [Fact]
    public async Task SaveAsync_UpdatesExistingSettings_WithoutLosingUnchangedValues()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(dbContext, "Settings User B");
        var service = new UserSettingsService(dbContext);

        await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 30m,
                YearlyGoalMiles: 1500m,
                OilChangePrice: 80m,
                MileageRateCents: 65m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None
        );

        await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 32m,
                YearlyGoalMiles: null,
                OilChangePrice: null,
                MileageRateCents: null,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None,
            new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "averageCarMpg" }
        );

        var loaded = await service.GetAsync(user.UserId, CancellationToken.None);
        Assert.NotNull(loaded.Response);
        Assert.Equal(32m, loaded.Response.Settings.AverageCarMpg);
        Assert.Equal(1500m, loaded.Response.Settings.YearlyGoalMiles);
        Assert.Equal(80m, loaded.Response.Settings.OilChangePrice);
        Assert.Equal(65m, loaded.Response.Settings.MileageRateCents);
    }

    [Fact]
    public async Task SaveAsync_RejectsLatitudeOutsideValidRange()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(dbContext, "Settings User C");
        var service = new UserSettingsService(dbContext);

        var result = await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31m,
                YearlyGoalMiles: 1400m,
                OilChangePrice: 70m,
                MileageRateCents: 50m,
                LocationLabel: "Office",
                Latitude: 100m,
                Longitude: -71m
            ),
            CancellationToken.None
        );

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
    }

    [Fact]
    public async Task SaveAsync_RejectsCoordinateWhenPairIsIncomplete()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(dbContext, "Settings User D");
        var service = new UserSettingsService(dbContext);

        var result = await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31m,
                YearlyGoalMiles: 1400m,
                OilChangePrice: 70m,
                MileageRateCents: 50m,
                LocationLabel: "Office",
                Latitude: 42.3601m,
                Longitude: null
            ),
            CancellationToken.None
        );

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
    }

    [Fact]
    public async Task SaveAsync_ClearsField_WhenExplicitNullProvidedOnUpdate()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(dbContext, "Settings User E");
        var service = new UserSettingsService(dbContext);

        await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 31m,
                YearlyGoalMiles: 1400m,
                OilChangePrice: 70m,
                MileageRateCents: 50m,
                LocationLabel: "Office",
                Latitude: 42.3601m,
                Longitude: -71.0589m
            ),
            CancellationToken.None
        );

        var updateResult = await service.SaveAsync(
            user.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: null,
                YearlyGoalMiles: 1600m,
                OilChangePrice: 70m,
                MileageRateCents: 50m,
                LocationLabel: "Office",
                Latitude: 42.3601m,
                Longitude: -71.0589m
            ),
            CancellationToken.None
        );

        Assert.True(updateResult.IsSuccess);

        var loaded = await service.GetAsync(user.UserId, CancellationToken.None);
        Assert.NotNull(loaded.Response);
        Assert.Null(loaded.Response.Settings.AverageCarMpg);
        Assert.Equal(1600m, loaded.Response.Settings.YearlyGoalMiles);
    }

    [Fact]
    public async Task SaveAsync_DoesNotAffectAnotherUsersSettings()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var firstUser = await SeedUserAsync(dbContext, "Settings User F");
        var secondUser = await SeedUserAsync(dbContext, "Settings User G");
        var service = new UserSettingsService(dbContext);

        await service.SaveAsync(
            firstUser.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 25m,
                YearlyGoalMiles: 1000m,
                OilChangePrice: 45m,
                MileageRateCents: 50m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None
        );

        await service.SaveAsync(
            secondUser.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 35m,
                YearlyGoalMiles: 2200m,
                OilChangePrice: 95m,
                MileageRateCents: 70m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None
        );

        await service.SaveAsync(
            firstUser.UserId,
            new UserSettingsUpsertRequest(
                AverageCarMpg: 30m,
                YearlyGoalMiles: 1200m,
                OilChangePrice: 55m,
                MileageRateCents: 52m,
                LocationLabel: null,
                Latitude: null,
                Longitude: null
            ),
            CancellationToken.None
        );

        var secondLoaded = await service.GetAsync(secondUser.UserId, CancellationToken.None);

        Assert.NotNull(secondLoaded.Response);
        Assert.Equal(35m, secondLoaded.Response.Settings.AverageCarMpg);
        Assert.Equal(2200m, secondLoaded.Response.Settings.YearlyGoalMiles);
        Assert.Equal(95m, secondLoaded.Response.Settings.OilChangePrice);
        Assert.Equal(70m, secondLoaded.Response.Settings.MileageRateCents);
    }

    private static async Task<UserEntity> SeedUserAsync(
        BikeTrackingDbContext dbContext,
        string name
    )
    {
        var user = new UserEntity
        {
            DisplayName = name,
            NormalizedName = name.ToUpperInvariant(),
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return user;
    }
}
