namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class WeatherLookupEntity
{
    public int WeatherLookupId { get; set; }

    public DateTime LookupHourUtc { get; set; }

    public decimal LatitudeRounded { get; set; }

    public decimal LongitudeRounded { get; set; }

    public decimal? Temperature { get; set; }

    public decimal? WindSpeedMph { get; set; }

    public int? WindDirectionDeg { get; set; }

    public int? RelativeHumidityPercent { get; set; }

    public int? CloudCoverPercent { get; set; }

    public string? PrecipitationType { get; set; }

    public required string DataSource { get; set; }

    public DateTime RetrievedAtUtc { get; set; }

    public required string Status { get; set; }
}
