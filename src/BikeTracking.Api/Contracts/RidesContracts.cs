using System.ComponentModel.DataAnnotations;

namespace BikeTracking.Api.Contracts;

public sealed record RecordRideRequest(
    [property: Required(ErrorMessage = "Ride date/time is required")] DateTime RideDateTimeLocal,
    [property: Required(ErrorMessage = "Miles is required")]
    [property: Range(0.01, double.MaxValue, ErrorMessage = "Miles must be greater than 0")]
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
