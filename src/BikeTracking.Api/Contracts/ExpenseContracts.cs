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
