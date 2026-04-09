namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class ImportJobEntity
{
    public long Id { get; set; }
    public long RiderId { get; set; }
    public required string FileName { get; set; }
    public int TotalRows { get; set; }
    public int ProcessedRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }
    public int FailedRows { get; set; }
    public required string Status { get; set; }
    public bool OverrideAllDuplicates { get; set; }
    public int? EtaMinutesRounded { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? LastError { get; set; }

    public ICollection<ImportRowEntity> Rows { get; set; } = new List<ImportRowEntity>();
}
