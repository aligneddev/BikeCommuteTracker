namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class RideEntity
{
    public int Id { get; set; }

    public long RiderId { get; set; }

    public DateTime RideDateTimeLocal { get; set; }

    public decimal Miles { get; set; }

    public int? RideMinutes { get; set; }

    public decimal? Temperature { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}
