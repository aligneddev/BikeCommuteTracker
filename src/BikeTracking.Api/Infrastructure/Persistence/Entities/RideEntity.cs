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

    public int Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; }
}
