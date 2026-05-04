namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class RidePresetEntity
{
    public long RidePresetId { get; set; }

    public long RiderId { get; set; }

    public required string Name { get; set; }

    public required string PrimaryDirection { get; set; }

    public required string PeriodTag { get; set; }

    public TimeOnly ExactStartTimeLocal { get; set; }

    public int DurationMinutes { get; set; }

    public DateTime? LastUsedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public int Version { get; set; } = 1;
}
