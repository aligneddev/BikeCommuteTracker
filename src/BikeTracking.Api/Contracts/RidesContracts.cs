using System.ComponentModel.DataAnnotations;

namespace BikeTracking.Api.Contracts;

public sealed record RecordRideRequest(
    [property: Required(ErrorMessage = "Ride date/time is required")] DateTime RideDateTimeLocal,
    [property: Required(ErrorMessage = "Miles is required")]
    [property: Range(
        0.01,
        200,
        ErrorMessage = "Miles must be greater than 0 and less than or equal to 200"
    )]
        decimal Miles,
    [property: Range(1, int.MaxValue, ErrorMessage = "Ride minutes must be greater than 0")]
        int? RideMinutes = null,
    decimal? Temperature = null,
    [property: Range(0.01, 999.9999, ErrorMessage = "Gas price must be between 0.01 and 999.9999")]
        decimal? GasPricePerGallon = null,
    [property: Range(0, 500, ErrorMessage = "Wind speed must be between 0 and 500 mph")]
        decimal? WindSpeedMph = null,
    [property: Range(0, 360, ErrorMessage = "Wind direction must be between 0 and 360 degrees")]
        int? WindDirectionDeg = null,
    [property: Range(0, 100, ErrorMessage = "Relative humidity must be between 0 and 100")]
        int? RelativeHumidityPercent = null,
    [property: Range(0, 100, ErrorMessage = "Cloud cover must be between 0 and 100")]
        int? CloudCoverPercent = null,
    [property: MaxLength(50, ErrorMessage = "Precipitation type must be 50 characters or fewer")]
        string? PrecipitationType = null,
    [property: MaxLength(500, ErrorMessage = "Note must be 500 characters or fewer")]
        string? Note = null,
    bool WeatherUserOverridden = false,
    [property: Range(1, 5, ErrorMessage = "Difficulty must be between 1 and 5")]
        int? Difficulty = null,
    [property: MaxLength(
        5,
        ErrorMessage = "Primary travel direction must be 5 characters or fewer"
    )]
        string? PrimaryTravelDirection = null,
    [property: Range(1, long.MaxValue, ErrorMessage = "Selected preset id must be greater than 0")]
        long? SelectedPresetId = null
);

public sealed record RecordRideSuccessResponse(
    long RideId,
    long RiderId,
    DateTime SavedAtUtc,
    string EventStatus
);

public sealed record GasPriceResponse(
    string Date,
    decimal? PricePerGallon,
    bool IsAvailable,
    string? DataSource
);

public sealed record RideWeatherResponse(
    DateTime RideDateTimeLocal,
    decimal? Temperature,
    decimal? WindSpeedMph,
    int? WindDirectionDeg,
    int? RelativeHumidityPercent,
    int? CloudCoverPercent,
    string? PrecipitationType,
    bool IsAvailable
);

public sealed record RidePresetDto(
    long PresetId,
    string Name,
    string PrimaryDirection,
    string PeriodTag,
    string ExactStartTimeLocal,
    int DurationMinutes,
    DateTime? LastUsedAtUtc,
    DateTime UpdatedAtUtc
);

public sealed record RidePresetsResponse(
    IReadOnlyList<RidePresetDto> Presets,
    DateTime GeneratedAtUtc
);

public sealed record UpsertRidePresetRequest(
    [property: Required(ErrorMessage = "Preset name is required")]
    [property: StringLength(
        80,
        MinimumLength = 1,
        ErrorMessage = "Preset name must be between 1 and 80 characters"
    )]
        string Name,
    [property: Required(ErrorMessage = "Primary direction is required")]
    [property: MaxLength(5, ErrorMessage = "Primary direction must be 5 characters or fewer")]
        string PrimaryDirection,
    [property: Required(ErrorMessage = "Period tag is required")]
    [property: RegularExpression(
        "^(morning|afternoon)$",
        ErrorMessage = "Period tag must be 'morning' or 'afternoon'"
    )]
        string PeriodTag,
    [property: Required(ErrorMessage = "Exact start time is required")]
    [property: RegularExpression(
        "^([01]\\d|2[0-3]):[0-5]\\d$",
        ErrorMessage = "Exact start time must be in HH:mm format"
    )]
        string ExactStartTimeLocal,
    [property: Range(1, 1440, ErrorMessage = "Duration minutes must be between 1 and 1440")]
        int DurationMinutes
);

public sealed record DeleteRidePresetResponse(long PresetId, DateTime DeletedAtUtc, string Message);

public sealed record EditRideRequest(
    [property: Required(ErrorMessage = "Ride date/time is required")] DateTime RideDateTimeLocal,
    [property: Required(ErrorMessage = "Miles is required")]
    [property: Range(
        0.01,
        200,
        ErrorMessage = "Miles must be greater than 0 and less than or equal to 200"
    )]
        decimal Miles,
    [property: Range(1, int.MaxValue, ErrorMessage = "Ride minutes must be greater than 0")]
        int? RideMinutes,
    decimal? Temperature,
    [property: Range(1, int.MaxValue, ErrorMessage = "Expected version must be at least 1")]
        int ExpectedVersion,
    [property: Range(
        0.01,
        999.9999,
        ErrorMessage = "Gas price must be greater than 0.01 and less than or equal to 999.9999"
    )]
        decimal? GasPricePerGallon = null,
    [property: Range(0, 500, ErrorMessage = "Wind speed must be between 0 and 500 mph")]
        decimal? WindSpeedMph = null,
    [property: Range(0, 360, ErrorMessage = "Wind direction must be between 0 and 360 degrees")]
        int? WindDirectionDeg = null,
    [property: Range(0, 100, ErrorMessage = "Relative humidity must be between 0 and 100")]
        int? RelativeHumidityPercent = null,
    [property: Range(0, 100, ErrorMessage = "Cloud cover must be between 0 and 100")]
        int? CloudCoverPercent = null,
    [property: MaxLength(50, ErrorMessage = "Precipitation type must be 50 characters or fewer")]
        string? PrecipitationType = null,
    [property: MaxLength(500, ErrorMessage = "Note must be 500 characters or fewer")]
        string? Note = null,
    bool WeatherUserOverridden = false,
    [property: Range(1, 5, ErrorMessage = "Difficulty must be between 1 and 5")]
        int? Difficulty = null,
    [property: MaxLength(
        5,
        ErrorMessage = "Primary travel direction must be 5 characters or fewer"
    )]
        string? PrimaryTravelDirection = null
);

public sealed record EditRideResponse(long RideId, int NewVersion, string Message);

public sealed record DeleteRideResponse(
    long RideId,
    DateTime DeletedAtUtc,
    bool IsIdempotent = false
);

/// <summary>
/// Aggregated miles and ride count for a defined period (thisMonth, thisYear, allTime, or filtered).
/// </summary>
public sealed record MileageSummary(decimal Miles, int RideCount, string Period);

/// <summary>
/// A single ride row for display in the history grid.
/// </summary>
public sealed record RideHistoryRow(
    long RideId,
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes = null,
    decimal? Temperature = null,
    decimal? GasPricePerGallon = null,
    decimal? WindSpeedMph = null,
    int? WindDirectionDeg = null,
    int? RelativeHumidityPercent = null,
    int? CloudCoverPercent = null,
    string? PrecipitationType = null,
    string? Note = null,
    bool WeatherUserOverridden = false,
    int? Difficulty = null,
    string? PrimaryTravelDirection = null,
    int? WindResistanceRating = null
);

/// <summary>
/// Nested container for summary totals by period.
/// </summary>
public sealed record RideHistorySummaries(
    MileageSummary ThisMonth,
    MileageSummary ThisYear,
    MileageSummary AllTime
);

/// <summary>
/// Full response for GET /api/rides/history endpoint: summaries + filtered total + paged rows.
/// </summary>
public sealed record RideHistoryResponse(
    RideHistorySummaries Summaries,
    MileageSummary FilteredTotal,
    IReadOnlyList<RideHistoryRow> Rides,
    int Page,
    int PageSize,
    int TotalRows
);
