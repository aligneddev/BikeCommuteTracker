using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.ExpenseImports;

public sealed class CsvExpenseImportService(
    BikeTrackingDbContext dbContext,
    CsvExpenseParser parser,
    ExpenseDuplicateDetector duplicateDetector,
    RecordExpenseService recordExpenseService,
    EditExpenseService editExpenseService
)
{
    public sealed record OperationError(string Code, string Message, int StatusCode);

    public sealed record OperationResult<T>(T? Value, OperationError? Error)
    {
        public bool IsSuccess => Error is null;

        public static OperationResult<T> Success(T value) => new(value, null);

        public static OperationResult<T> Failure(string code, string message, int statusCode) =>
            new(default, new OperationError(code, message, statusCode));
    }

    public async Task<ExpenseImportPreviewResponse> PreviewAsync(
        long riderId,
        string fileName,
        string csvText,
        CancellationToken cancellationToken = default
    )
    {
        var parsedDocument = parser.Parse(csvText);
        var persistedRows = new List<ExpenseImportRowEntity>();
        var errors = new List<ExpenseImportRowErrorView>();
        var candidates = new List<ExpenseImportCandidate>();

        foreach (var row in parsedDocument.Rows)
        {
            var validationErrors = parser.ValidateRow(row);
            var isValid = validationErrors.Count == 0;
            DateOnly? parsedDate = null;
            decimal? parsedAmount = null;

            if (parser.TryParseDate(row.Date, out var dateValue))
            {
                parsedDate = dateValue;
            }

            if (parser.TryParseAmount(row.Amount, out var amountValue))
            {
                parsedAmount = decimal.Round(amountValue, 2, MidpointRounding.AwayFromZero);
            }

            if (!isValid)
            {
                errors.AddRange(
                    validationErrors.Select(error => new ExpenseImportRowErrorView(
                        row.RowNumber,
                        error.Field,
                        error.Message
                    ))
                );
            }

            if (isValid && parsedDate.HasValue && parsedAmount.HasValue)
            {
                candidates.Add(
                    new ExpenseImportCandidate(row.RowNumber, parsedDate.Value, parsedAmount.Value)
                );
            }

            persistedRows.Add(
                new ExpenseImportRowEntity
                {
                    RowNumber = row.RowNumber,
                    ExpenseDateLocal = parsedDate,
                    Amount = parsedAmount,
                    Notes = string.IsNullOrWhiteSpace(row.Note) ? null : row.Note,
                    ValidationStatus = isValid ? "valid" : "invalid",
                    ValidationErrorsJson =
                        validationErrors.Count == 0
                            ? null
                            : System.Text.Json.JsonSerializer.Serialize(validationErrors),
                    DuplicateStatus = "none",
                    DuplicateResolution = null,
                    ProcessingStatus = isValid ? "pending" : "failed",
                    ExistingExpenseIdsJson = null,
                    CreatedExpenseId = null,
                }
            );
        }

        var duplicateLookup = await duplicateDetector.GetDuplicateMatchesAsync(
            riderId,
            candidates,
            cancellationToken
        );
        var duplicateViews = new List<ExpenseImportDuplicateView>();
        foreach (var row in persistedRows.Where(static row => row.ValidationStatus == "valid"))
        {
            if (!duplicateLookup.TryGetValue(row.RowNumber, out var matches) || matches.Count == 0)
            {
                continue;
            }

            row.DuplicateStatus = "duplicate";
            row.ExistingExpenseIdsJson = ExpenseDuplicateDetector.SerializeExistingExpenseIds(
                matches
            );
            duplicateViews.Add(
                new ExpenseImportDuplicateView(
                    row.RowNumber,
                    row.ExpenseDateLocal!.Value,
                    row.Amount!.Value,
                    row.Notes,
                    matches
                        .Select(match => new ExistingExpenseMatchView(
                            match.Id,
                            DateOnly.FromDateTime(match.ExpenseDate),
                            match.Amount,
                            match.Notes
                        ))
                        .ToArray()
                )
            );
        }

        var job = new ExpenseImportJobEntity
        {
            RiderId = riderId,
            FileName = fileName,
            TotalRows = persistedRows.Count,
            ValidRows = persistedRows.Count(static row => row.ValidationStatus == "valid"),
            InvalidRows = persistedRows.Count(static row => row.ValidationStatus == "invalid"),
            ImportedRows = 0,
            SkippedRows = 0,
            OverrideAllDuplicates = false,
            Status = "awaiting-confirmation",
            LastError = null,
            CreatedAtUtc = DateTime.UtcNow,
            CompletedAtUtc = null,
            Rows = persistedRows,
        };

        dbContext.ExpenseImportJobs.Add(job);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ExpenseImportPreviewResponse(
            job.Id,
            fileName,
            job.TotalRows,
            job.ValidRows,
            job.InvalidRows,
            duplicateViews.Count,
            errors,
            duplicateViews,
            job.ValidRows > 0
        );
    }

    public async Task<OperationResult<ExpenseImportSummaryResponse>> ConfirmAsync(
        long riderId,
        long jobId,
        ConfirmExpenseImportRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var job = await dbContext
            .ExpenseImportJobs.Include(static current => current.Rows)
            .SingleOrDefaultAsync(current => current.Id == jobId, cancellationToken);

        if (job is null)
        {
            return OperationResult<ExpenseImportSummaryResponse>.Failure(
                "NOT_FOUND",
                "Import job was not found.",
                StatusCodes.Status404NotFound
            );
        }

        if (job.RiderId != riderId)
        {
            return OperationResult<ExpenseImportSummaryResponse>.Failure(
                "FORBIDDEN",
                "Import job belongs to a different rider.",
                StatusCodes.Status403Forbidden
            );
        }

        if (job.Status == "completed" || job.Status == "processing")
        {
            return OperationResult<ExpenseImportSummaryResponse>.Failure(
                "CONFLICT",
                "Import job has already been confirmed.",
                StatusCodes.Status409Conflict
            );
        }

        if (job.Status != "awaiting-confirmation")
        {
            return OperationResult<ExpenseImportSummaryResponse>.Failure(
                "VALIDATION_FAILED",
                "Import job is not awaiting confirmation.",
                StatusCodes.Status400BadRequest
            );
        }

        job.Status = "processing";
        job.OverrideAllDuplicates = request.OverrideAllDuplicates;

        var choiceLookup = request.DuplicateChoices.ToDictionary(
            static choice => choice.RowNumber,
            static choice => choice.Resolution,
            EqualityComparer<int>.Default
        );

        var processingFailures = 0;
        foreach (var row in job.Rows.OrderBy(static current => current.RowNumber))
        {
            if (row.ValidationStatus != "valid")
            {
                continue;
            }

            var isDuplicate = row.DuplicateStatus == "duplicate";
            var resolution = request.OverrideAllDuplicates
                ? "override-all"
                : choiceLookup.GetValueOrDefault(row.RowNumber, "keep-existing");

            try
            {
                if (isDuplicate && !request.OverrideAllDuplicates && resolution == "keep-existing")
                {
                    row.DuplicateResolution = "keep-existing";
                    row.ProcessingStatus = "skipped";
                    job.SkippedRows += 1;
                    continue;
                }

                if (
                    isDuplicate
                    && !request.OverrideAllDuplicates
                    && resolution == "replace-with-import"
                )
                {
                    var existingExpenseIds = ExpenseDuplicateDetector.DeserializeExistingExpenseIds(
                        row.ExistingExpenseIdsJson
                    );
                    var existingExpenseId = existingExpenseIds.FirstOrDefault();
                    var existingExpense = await dbContext.Expenses.SingleOrDefaultAsync(
                        expense =>
                            expense.Id == existingExpenseId
                            && expense.RiderId == riderId
                            && !expense.IsDeleted,
                        cancellationToken
                    );

                    if (existingExpense is null)
                    {
                        row.ProcessingStatus = "failed";
                        processingFailures += 1;
                        continue;
                    }

                    var notes = string.IsNullOrWhiteSpace(row.Notes)
                        ? existingExpense.Notes
                        : row.Notes;
                    var editResult = await editExpenseService.ExecuteAsync(
                        riderId,
                        existingExpense.Id,
                        new EditExpenseRequest(
                            row.ExpenseDateLocal!.Value.ToDateTime(TimeOnly.MinValue),
                            row.Amount!.Value,
                            notes,
                            existingExpense.Version
                        ),
                        cancellationToken
                    );

                    if (!editResult.IsSuccess || editResult.Response is null)
                    {
                        row.ProcessingStatus = "failed";
                        processingFailures += 1;
                        continue;
                    }

                    row.DuplicateResolution = "replace-with-import";
                    row.ProcessingStatus = "processed";
                    row.CreatedExpenseId = existingExpense.Id;
                    job.ImportedRows += 1;
                    continue;
                }

                var recordResponse = await recordExpenseService.ExecuteAsync(
                    riderId,
                    new RecordExpenseRequest(
                        row.ExpenseDateLocal!.Value.ToDateTime(TimeOnly.MinValue),
                        row.Amount!.Value,
                        row.Notes
                    ),
                    cancellationToken: cancellationToken
                );

                row.DuplicateResolution = isDuplicate ? "override-all" : null;
                row.ProcessingStatus = "processed";
                row.CreatedExpenseId = recordResponse.ExpenseId;
                job.ImportedRows += 1;
            }
            catch
            {
                row.ProcessingStatus = "failed";
                processingFailures += 1;
            }
        }

        job.Status = "completed";
        job.CompletedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return OperationResult<ExpenseImportSummaryResponse>.Success(
            new ExpenseImportSummaryResponse(
                job.Id,
                job.TotalRows,
                job.ImportedRows,
                job.SkippedRows,
                job.InvalidRows + processingFailures
            )
        );
    }

    public async Task<OperationResult<ExpenseImportStatusResponse>> GetStatusAsync(
        long riderId,
        long jobId,
        CancellationToken cancellationToken = default
    )
    {
        var job = await dbContext
            .ExpenseImportJobs.AsNoTracking()
            .Include(static current => current.Rows)
            .SingleOrDefaultAsync(current => current.Id == jobId, cancellationToken);

        if (job is null)
        {
            return OperationResult<ExpenseImportStatusResponse>.Failure(
                "NOT_FOUND",
                "Import job was not found.",
                StatusCodes.Status404NotFound
            );
        }

        if (job.RiderId != riderId)
        {
            return OperationResult<ExpenseImportStatusResponse>.Failure(
                "FORBIDDEN",
                "Import job belongs to a different rider.",
                StatusCodes.Status403Forbidden
            );
        }

        ExpenseImportSummaryResponse? summary = null;
        if (job.Status == "completed")
        {
            summary = new ExpenseImportSummaryResponse(
                job.Id,
                job.TotalRows,
                job.ImportedRows,
                job.SkippedRows,
                job.Rows.Count(row =>
                    row.ValidationStatus == "invalid" || row.ProcessingStatus == "failed"
                )
            );
        }

        return OperationResult<ExpenseImportStatusResponse>.Success(
            new ExpenseImportStatusResponse(
                job.Id,
                job.Status,
                job.TotalRows,
                job.ValidRows,
                job.InvalidRows,
                job.Rows.Count(row => row.DuplicateStatus == "duplicate"),
                summary
            )
        );
    }

    public async Task<OperationResult<bool>> DeleteAsync(
        long riderId,
        long jobId,
        CancellationToken cancellationToken = default
    )
    {
        var job = await dbContext
            .ExpenseImportJobs.Include(static current => current.Rows)
            .SingleOrDefaultAsync(current => current.Id == jobId, cancellationToken);

        if (job is null)
        {
            return OperationResult<bool>.Failure(
                "NOT_FOUND",
                "Import job was not found.",
                StatusCodes.Status404NotFound
            );
        }

        if (job.RiderId != riderId)
        {
            return OperationResult<bool>.Failure(
                "FORBIDDEN",
                "Import job belongs to a different rider.",
                StatusCodes.Status403Forbidden
            );
        }

        dbContext.ExpenseImportJobs.Remove(job);
        await dbContext.SaveChangesAsync(cancellationToken);
        return OperationResult<bool>.Success(true);
    }
}
