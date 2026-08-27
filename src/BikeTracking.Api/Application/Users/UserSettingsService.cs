using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Users;

public sealed class UserSettingsService(BikeTrackingDbContext dbContext)
{
    private const string RegularGasGrade = "Regular";
    private const string PremiumGasGrade = "Premium";

    private static readonly string[] AllSettingsFields =
    [
        "averagecarmpg",
        "yearlygoalmiles",
        "oilchangeprice",
        "mileageratecents",
        "locationlabel",
        "latitude",
        "longitude",
        "dashboardgallonsavoidedenabled",
        "dashboardgoalprogressenabled",
        "weatherapikey",
        "eiagasapikey",
        "gasgrade",
    ];

    private readonly BikeTrackingDbContext _dbContext = dbContext;

    public async Task<UserSettingsResult> GetAsync(
        long riderId,
        CancellationToken cancellationToken
    )
    {
        var existing = await _dbContext
            .UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == riderId, cancellationToken);

        if (existing is null)
        {
            return UserSettingsResult.Success(
                new UserSettingsResponse(
                    HasSettings: false,
                    Settings: new UserSettingsView(
                        AverageCarMpg: null,
                        YearlyGoalMiles: null,
                        OilChangePrice: null,
                        MileageRateCents: null,
                        LocationLabel: null,
                        Latitude: null,
                        Longitude: null,
                        UpdatedAtUtc: null,
                        GasGrade: RegularGasGrade
                    )
                )
            );
        }

        return UserSettingsResult.Success(ToResponse(existing));
    }

    public async Task<UserSettingsResult> SaveAsync(
        long riderId,
        UserSettingsUpsertRequest request,
        CancellationToken cancellationToken,
        ISet<string>? providedFields = null
    )
    {
        var existing = await _dbContext.UserSettings.SingleOrDefaultAsync(
            x => x.UserId == riderId,
            cancellationToken
        );

        var normalizedFields = NormalizeFields(providedFields);

        var averageCarMpg = ResolveNullableDecimal(
            existing?.AverageCarMpg,
            request.AverageCarMpg,
            normalizedFields.Contains("averagecarmpg")
        );
        var yearlyGoalMiles = ResolveNullableDecimal(
            existing?.YearlyGoalMiles,
            request.YearlyGoalMiles,
            normalizedFields.Contains("yearlygoalmiles")
        );
        var oilChangePrice = ResolveNullableDecimal(
            existing?.OilChangePrice,
            request.OilChangePrice,
            normalizedFields.Contains("oilchangeprice")
        );
        var mileageRateCents = ResolveNullableDecimal(
            existing?.MileageRateCents,
            request.MileageRateCents,
            normalizedFields.Contains("mileageratecents")
        );
        var locationLabel = ResolveNullableString(
            existing?.LocationLabel,
            request.LocationLabel,
            normalizedFields.Contains("locationlabel")
        );
        var mergedLatitude = ResolveNullableDecimal(
            existing?.Latitude,
            request.Latitude,
            normalizedFields.Contains("latitude")
        );
        var mergedLongitude = ResolveNullableDecimal(
            existing?.Longitude,
            request.Longitude,
            normalizedFields.Contains("longitude")
        );
        var dashboardGallonsAvoidedEnabled = ResolveBoolean(
            existing?.DashboardGallonsAvoidedEnabled ?? false,
            request.DashboardGallonsAvoidedEnabled,
            normalizedFields.Contains("dashboardgallonsavoidedenabled")
        );
        var dashboardGoalProgressEnabled = ResolveBoolean(
            existing?.DashboardGoalProgressEnabled ?? false,
            request.DashboardGoalProgressEnabled,
            normalizedFields.Contains("dashboardgoalprogressenabled")
        );
        var weatherApiKey = ResolveNullableString(
            existing?.WeatherApiKey,
            request.WeatherApiKey,
            normalizedFields.Contains("weatherapikey")
        );
        var eiaGasApiKey = ResolveNullableString(
            existing?.EiaGasApiKey,
            request.EiaGasApiKey,
            normalizedFields.Contains("eiagasapikey")
        );
        var gasGradeCandidate = ResolveGasGrade(
            existing?.GasGrade,
            request.GasGrade,
            normalizedFields.Contains("gasgrade")
        );

        if (!TryNormalizeGasGrade(gasGradeCandidate, out var normalizedGasGrade))
        {
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Gas grade must be either 'Regular' or 'Premium'."
            );
        }

        if (averageCarMpg is <= 0)
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Average car mpg must be greater than 0."
            );
        if (yearlyGoalMiles is <= 0)
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Yearly goal must be greater than 0."
            );
        if (oilChangePrice is <= 0)
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Oil change price must be greater than 0."
            );
        if (mileageRateCents is <= 0)
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Mileage rate must be greater than 0."
            );

        if (mergedLatitude.HasValue != mergedLongitude.HasValue)
        {
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Latitude and longitude must both be provided."
            );
        }

        if (mergedLatitude is < -90m or > 90m)
        {
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Latitude must be between -90 and 90."
            );
        }

        if (mergedLongitude is < -180m or > 180m)
        {
            return UserSettingsResult.Failure(
                UsersErrorCodes.ValidationFailed,
                "Longitude must be between -180 and 180."
            );
        }

        if (existing is null)
        {
            existing = new UserSettingsEntity
            {
                UserId = riderId,
                AverageCarMpg = averageCarMpg,
                YearlyGoalMiles = yearlyGoalMiles,
                OilChangePrice = oilChangePrice,
                MileageRateCents = mileageRateCents,
                LocationLabel = locationLabel,
                Latitude = mergedLatitude,
                Longitude = mergedLongitude,
                DashboardGallonsAvoidedEnabled = dashboardGallonsAvoidedEnabled,
                DashboardGoalProgressEnabled = dashboardGoalProgressEnabled,
                WeatherApiKey = weatherApiKey,
                EiaGasApiKey = eiaGasApiKey,
                GasGrade = normalizedGasGrade,
                UpdatedAtUtc = DateTime.UtcNow,
            };

            _dbContext.UserSettings.Add(existing);
        }
        else
        {
            existing.AverageCarMpg = averageCarMpg;
            existing.YearlyGoalMiles = yearlyGoalMiles;
            existing.OilChangePrice = oilChangePrice;
            existing.MileageRateCents = mileageRateCents;
            existing.LocationLabel = locationLabel;
            existing.Latitude = mergedLatitude;
            existing.Longitude = mergedLongitude;
            existing.DashboardGallonsAvoidedEnabled = dashboardGallonsAvoidedEnabled;
            existing.DashboardGoalProgressEnabled = dashboardGoalProgressEnabled;
            existing.WeatherApiKey = weatherApiKey;
            existing.EiaGasApiKey = eiaGasApiKey;
            existing.GasGrade = normalizedGasGrade;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return UserSettingsResult.Success(ToResponse(existing));
    }

    private static UserSettingsResponse ToResponse(UserSettingsEntity entity)
    {
        return new UserSettingsResponse(
            HasSettings: true,
            Settings: new UserSettingsView(
                AverageCarMpg: entity.AverageCarMpg,
                YearlyGoalMiles: entity.YearlyGoalMiles,
                OilChangePrice: entity.OilChangePrice,
                MileageRateCents: entity.MileageRateCents,
                LocationLabel: entity.LocationLabel,
                Latitude: entity.Latitude,
                Longitude: entity.Longitude,
                DashboardGallonsAvoidedEnabled: entity.DashboardGallonsAvoidedEnabled,
                DashboardGoalProgressEnabled: entity.DashboardGoalProgressEnabled,
                UpdatedAtUtc: entity.UpdatedAtUtc,
                WeatherApiKey: entity.WeatherApiKey,
                EiaGasApiKey: entity.EiaGasApiKey,
                GasGrade: NormalizeGasGradeForRead(entity.GasGrade)
            )
        );
    }

    private static HashSet<string> NormalizeFields(ISet<string>? providedFields)
    {
        if (providedFields is null)
        {
            return new HashSet<string>(AllSettingsFields, StringComparer.OrdinalIgnoreCase);
        }

        return providedFields
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static decimal? ResolveNullableDecimal(
        decimal? existing,
        decimal? requested,
        bool isProvided
    )
    {
        return isProvided ? requested : existing;
    }

    private static string? ResolveNullableString(
        string? existing,
        string? requested,
        bool isProvided
    )
    {
        return isProvided ? requested : existing;
    }

    private static bool ResolveBoolean(bool existing, bool? requested, bool isProvided)
    {
        return isProvided ? requested ?? false : existing;
    }

    private static string ResolveGasGrade(string? existing, string? requested, bool isProvided)
    {
        var candidate = isProvided ? requested : existing;
        return string.IsNullOrWhiteSpace(candidate) ? RegularGasGrade : candidate.Trim();
    }

    private static bool TryNormalizeGasGrade(string? gasGrade, out string normalized)
    {
        if (string.Equals(gasGrade, RegularGasGrade, StringComparison.OrdinalIgnoreCase))
        {
            normalized = RegularGasGrade;
            return true;
        }

        if (string.Equals(gasGrade, PremiumGasGrade, StringComparison.OrdinalIgnoreCase))
        {
            normalized = PremiumGasGrade;
            return true;
        }

        normalized = string.Empty;
        return false;
    }

    private static string NormalizeGasGradeForRead(string? gasGrade)
    {
        return TryNormalizeGasGrade(gasGrade, out var normalized) ? normalized : RegularGasGrade;
    }
}

public sealed record UserSettingsResult(
    bool IsSuccess,
    UserSettingsResponse? Response,
    ErrorResponse? Error
)
{
    public static UserSettingsResult Success(UserSettingsResponse response) =>
        new(true, response, null);

    public static UserSettingsResult Failure(string code, string message) =>
        new(false, null, new ErrorResponse(code, message));
}
