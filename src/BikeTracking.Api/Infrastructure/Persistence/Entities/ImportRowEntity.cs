namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class ImportRowEntity
{
    public long Id { get; set; }
    public long ImportJobId { get; set; }
    public int RowNumber { get; set; }
    public DateOnly? RideDateLocal { get; set; }
    public decimal? Miles { get; set; }
    public int? RideMinutes { get; set; }
    public decimal? Temperature { get; set; }
    public string? TagsRaw { get; set; }
    public string? Notes { get; set; }
    public required string ValidationStatus { get; set; }
    public string? ValidationErrorsJson { get; set; }
    public required string DuplicateStatus { get; set; }
    public string? DuplicateResolution { get; set; }
    public required string ProcessingStatus { get; set; }
    public string? ExistingRideIdsJson { get; set; }
    public long? CreatedRideId { get; set; }

    public ImportJobEntity ImportJob { get; set; } = null!;
}
