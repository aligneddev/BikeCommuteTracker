namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class UserSettingsEntity
{
    public long UserId { get; set; }

    public decimal? AverageCarMpg { get; set; }

    public decimal? YearlyGoalMiles { get; set; }

    public decimal? OilChangePrice { get; set; }

    public decimal? MileageRateCents { get; set; }

    public string? LocationLabel { get; set; }

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
