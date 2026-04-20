using System.ComponentModel.DataAnnotations;

namespace BikeTracking.Api.Contracts;

public sealed record ExpenseImportPreviewRequest(
    [property: Required] string FileName,
    [property: Required] string ContentBase64
);

public sealed record ExpenseImportRowErrorView(int RowNumber, string Field, string Message);

public sealed record ExistingExpenseMatchView(
    long ExpenseId,
    DateOnly ExpenseDate,
    decimal Amount,
    string? Note
);

public sealed record ExpenseImportDuplicateView(
    int RowNumber,
    DateOnly ExpenseDate,
    decimal Amount,
    string? Note,
    IReadOnlyList<ExistingExpenseMatchView> ExistingMatches
);

public sealed record ExpenseImportPreviewResponse(
    long JobId,
    string FileName,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateCount,
    IReadOnlyList<ExpenseImportRowErrorView> Errors,
    IReadOnlyList<ExpenseImportDuplicateView> Duplicates,
    bool CanConfirmImport
);

public sealed record ExpenseDuplicateResolutionChoice(int RowNumber, string Resolution);

public sealed record ConfirmExpenseImportRequest(
    bool OverrideAllDuplicates,
    IReadOnlyList<ExpenseDuplicateResolutionChoice> DuplicateChoices
);

public sealed record ExpenseImportSummaryResponse(
    long JobId,
    int TotalRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows
);

public sealed record ExpenseImportStatusResponse(
    long JobId,
    string Status,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateCount,
    ExpenseImportSummaryResponse? Summary
);