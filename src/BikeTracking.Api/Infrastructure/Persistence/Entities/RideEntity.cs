namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class RideEntity
{
    public int Id { get; set; }

    public long RiderId { get; set; }

    public DateTime RideDateTimeLocal { get; set; }

    public decimal Miles { get; set; }

    public int? RideMinutes { get; set; }

    public decimal? Temperature { get; set; }

    public decimal? GasPricePerGallon { get; set; }

    public decimal? SnapshotAverageCarMpg { get; set; }

    public decimal? SnapshotMileageRateCents { get; set; }

    public decimal? SnapshotYearlyGoalMiles { get; set; }

    public decimal? SnapshotOilChangePrice { get; set; }

    public decimal? WindSpeedMph { get; set; }

    public int? WindDirectionDeg { get; set; }

    public int? RelativeHumidityPercent { get; set; }

    public int? CloudCoverPercent { get; set; }

    public string? PrecipitationType { get; set; }

    public string? Notes { get; set; }

    public bool WeatherUserOverridden { get; set; }

    /// <summary>
    /// Rider-supplied or auto-calculated difficulty rating (1 = Very Easy … 5 = Very Hard).
    /// Null when neither manually set nor calculable from wind data.
    /// </summary>
    public int? Difficulty { get; set; }

    /// <summary>
    /// Primary travel direction selected by the rider at record or import time.
    /// Stored as canonical string: "North", "NE", "NW", "South", "SE", "SW", "East", "West".
    /// Null when not provided.
    /// </summary>
    public string? PrimaryTravelDirection { get; set; }

    /// <summary>
    /// Computed wind resistance rating (−4 strong tailwind … +4 strong headwind).
    /// Calculated from WindSpeedMph × cos(angle) / 5, clamped and rounded to integer.
    /// Persisted at save/import time; not recomputed on read.
    /// Null when PrimaryTravelDirection or WindSpeedMph was not available at write time.
    /// </summary>
    public int? WindResistanceRating { get; set; }

    public int Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; }
}
