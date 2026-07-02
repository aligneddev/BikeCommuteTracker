namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class MonthlySummaryAuditLogEntity
{
    public long Id { get; init; }
    public long RiderId { get; init; }
    public long ImportJobId { get; init; }
    public DateTime TimestampUtc { get; init; }
    public int StartYear { get; init; }
    public int EndYear { get; init; }
    public int MonthsParsed { get; init; }
    public int RidesCreated { get; init; }
    public int RidesReplaced { get; init; }
    public int RidesSkipped { get; init; }
    public int RowsRejected { get; init; }
    public string? ValidationErrorsSummaryJson { get; init; }
}
