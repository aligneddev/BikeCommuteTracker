namespace BikeTracking.Api.Contracts;

public sealed record SignupRequest(string Name, string Pin);

public sealed record SignupSuccessResponse(
    long UserId,
    string UserName,
    DateTime CreatedAtUtc,
    string EventStatus
);

public sealed record IdentifyRequest(string Name, string Pin);

public sealed record IdentifySuccessResponse(long UserId, string UserName, bool Authorized);

public sealed record UserSettingsUpsertRequest(
    decimal? AverageCarMpg,
    decimal? YearlyGoalMiles,
    decimal? OilChangePrice,
    decimal? MileageRateCents,
    string? LocationLabel,
    decimal? Latitude,
    decimal? Longitude,
    bool? DashboardGallonsAvoidedEnabled = null,
    bool? DashboardGoalProgressEnabled = null
);

public sealed record UserSettingsView(
    decimal? AverageCarMpg,
    decimal? YearlyGoalMiles,
    decimal? OilChangePrice,
    decimal? MileageRateCents,
    string? LocationLabel,
    decimal? Latitude,
    decimal? Longitude,
    bool DashboardGallonsAvoidedEnabled = false,
    bool DashboardGoalProgressEnabled = false,
    DateTime? UpdatedAtUtc = null
);

public sealed record UserSettingsResponse(bool HasSettings, UserSettingsView Settings);

public sealed record ErrorResponse(
    string Code,
    string Message,
    IReadOnlyList<string>? Details = null
);

public sealed record ThrottleResponse(string Code, string Message, int RetryAfterSeconds);

public sealed record UserRegisteredEventPayload(
    Guid EventId,
    string EventType,
    DateTime OccurredAtUtc,
    long UserId,
    string UserName,
    string Source
)
{
    public const string EventTypeName = "UserRegistered";

    public static UserRegisteredEventPayload Create(
        long userId,
        string userName,
        DateTime occurredAtUtc
    )
    {
        return new UserRegisteredEventPayload(
            Guid.NewGuid(),
            EventTypeName,
            occurredAtUtc,
            userId,
            userName,
            "BikeTracking.Api"
        );
    }
}

public static class UsersErrorCodes
{
    public const string ValidationFailed = "validation_failed";
    public const string NameAlreadyExists = "name_already_exists";
    public const string InvalidCredentials = "invalid_credentials";
    public const string Throttled = "throttled";
    public const string SettingsNotFound = "settings_not_found";
}
