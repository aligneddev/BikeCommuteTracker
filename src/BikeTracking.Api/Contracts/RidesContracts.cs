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
    decimal? Temperature = null
);

public sealed record RecordRideSuccessResponse(
    long RideId,
    long RiderId,
    DateTime SavedAtUtc,
    string EventStatus
);

public sealed record RideDefaultsResponse(
    bool HasPreviousRide,
    DateTime DefaultRideDateTimeLocal,
    decimal? DefaultMiles = null,
    int? DefaultRideMinutes = null,
    decimal? DefaultTemperature = null
);

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
        int ExpectedVersion
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
    decimal? Temperature = null
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
