using System.ComponentModel.DataAnnotations.Schema;

namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

[Table("Expenses")]
public sealed class ExpenseEntity
{
    public long Id { get; set; }

    public long RiderId { get; set; }

    public DateTime ExpenseDate { get; set; }

    public decimal Amount { get; set; }

    public string? Notes { get; set; }

    public string? ReceiptPath { get; set; }

    public bool IsDeleted { get; set; }

    public int Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
