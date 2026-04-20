namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class ExpenseImportJobEntity
{
    public long Id { get; set; }
    public long RiderId { get; set; }
    public required string FileName { get; set; }
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int InvalidRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }
    public bool OverrideAllDuplicates { get; set; }
    public required string Status { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    public ICollection<ExpenseImportRowEntity> Rows { get; set; } = new List<ExpenseImportRowEntity>();
}