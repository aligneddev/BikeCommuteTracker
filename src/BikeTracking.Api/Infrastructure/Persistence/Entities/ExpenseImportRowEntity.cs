namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class ExpenseImportRowEntity
{
    public long Id { get; set; }
    public long ImportJobId { get; set; }
    public int RowNumber { get; set; }
    public DateOnly? ExpenseDateLocal { get; set; }
    public decimal? Amount { get; set; }
    public string? Notes { get; set; }
    public required string ValidationStatus { get; set; }
    public string? ValidationErrorsJson { get; set; }
    public required string DuplicateStatus { get; set; }
    public string? DuplicateResolution { get; set; }
    public required string ProcessingStatus { get; set; }
    public string? ExistingExpenseIdsJson { get; set; }
    public long? CreatedExpenseId { get; set; }

    public ExpenseImportJobEntity ImportJob { get; set; } = null!;
}