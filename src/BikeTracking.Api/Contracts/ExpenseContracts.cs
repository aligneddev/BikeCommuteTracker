using System.ComponentModel.DataAnnotations;

namespace BikeTracking.Api.Contracts;

public sealed record RecordExpenseRequest(
    [property: Required(ErrorMessage = "Expense date is required")] DateTime ExpenseDate,
    [property: Required(ErrorMessage = "Amount is required")]
    [property: Range(0.01, 999999.99, ErrorMessage = "Amount must be greater than 0")]
        decimal Amount,
    [property: MaxLength(500, ErrorMessage = "Note must be 500 characters or fewer")] string? Notes
);

public sealed record RecordExpenseResponse(
    long ExpenseId,
    long RiderId,
    DateTime SavedAtUtc,
    bool ReceiptAttached
);

public sealed record ExpenseHistoryRow(
    long ExpenseId,
    DateTime ExpenseDate,
    decimal Amount,
    string? Notes,
    bool HasReceipt,
    int Version,
    DateTime CreatedAtUtc
);

public sealed record ExpenseHistoryResponse(
    IReadOnlyList<ExpenseHistoryRow> Expenses,
    decimal TotalAmount,
    int ExpenseCount,
    DateTime GeneratedAtUtc
);

public sealed record EditExpenseRequest(
    [property: Required(ErrorMessage = "Expense date is required")] DateTime ExpenseDate,
    [property: Required(ErrorMessage = "Amount is required")]
    [property: Range(0.01, 999999.99, ErrorMessage = "Amount must be greater than 0")]
        decimal Amount,
    [property: MaxLength(500, ErrorMessage = "Note must be 500 characters or fewer")] string? Notes,
    [property: Range(1, int.MaxValue, ErrorMessage = "Expected version must be at least 1")]
        int ExpectedVersion
);

public sealed record EditExpenseResponse(long ExpenseId, DateTime SavedAtUtc, int NewVersion);

public sealed record DeleteExpenseResponse(long ExpenseId, DateTime DeletedAtUtc);
