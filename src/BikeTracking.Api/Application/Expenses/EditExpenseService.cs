using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Expenses;

public sealed class EditExpenseService(
    BikeTrackingDbContext dbContext,
    ILogger<EditExpenseService> logger
)
{
    public sealed record EditExpenseError(string Code, string Message, int? CurrentVersion = null);

    public sealed record EditExpenseResult(
        bool IsSuccess,
        EditExpenseResponse? Response,
        EditExpenseError? Error
    )
    {
        public static EditExpenseResult Success(EditExpenseResponse response)
        {
            return new EditExpenseResult(true, response, null);
        }

        public static EditExpenseResult Failure(
            string code,
            string message,
            int? currentVersion = null
        )
        {
            return new EditExpenseResult(
                false,
                null,
                new EditExpenseError(code, message, currentVersion)
            );
        }
    }

    public async Task<EditExpenseResult> ExecuteAsync(
        long riderId,
        long expenseId,
        EditExpenseRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var validationFailure = ValidateRequest(request);
        if (validationFailure is not null)
        {
            return validationFailure;
        }

        var expense = await dbContext
            .Expenses.Where(current => current.Id == expenseId)
            .SingleOrDefaultAsync(cancellationToken);

        if (expense is null || expense.RiderId != riderId || expense.IsDeleted)
        {
            return EditExpenseResult.Failure(
                "EXPENSE_NOT_FOUND",
                $"Expense {expenseId} was not found."
            );
        }

        var currentVersion = expense.Version <= 0 ? 1 : expense.Version;
        if (request.ExpectedVersion != currentVersion)
        {
            return EditExpenseResult.Failure(
                "EXPENSE_VERSION_CONFLICT",
                "Expense edit conflict. The expense was updated by another request.",
                currentVersion
            );
        }

        expense.ExpenseDate = request.ExpenseDate;
        expense.Amount = request.Amount;
        expense.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes;
        expense.Version = currentVersion + 1;
        expense.UpdatedAtUtc = DateTime.UtcNow;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return EditExpenseResult.Failure(
                "EXPENSE_VERSION_CONFLICT",
                "Expense edit conflict. The expense was updated by another request.",
                currentVersion
            );
        }

        logger.LogInformation(
            "Edited expense {ExpenseId} for rider {RiderId} from version {PreviousVersion} to {NewVersion}",
            expense.Id,
            riderId,
            currentVersion,
            expense.Version
        );

        return EditExpenseResult.Success(
            new EditExpenseResponse(expense.Id, expense.UpdatedAtUtc, expense.Version)
        );
    }

    private static EditExpenseResult? ValidateRequest(EditExpenseRequest request)
    {
        if (request.Amount <= 0)
        {
            return EditExpenseResult.Failure(
                "VALIDATION_FAILED",
                "Amount must be greater than 0."
            );
        }

        if (request.ExpectedVersion <= 0)
        {
            return EditExpenseResult.Failure(
                "VALIDATION_FAILED",
                "Expected version must be at least 1."
            );
        }

        if (request.Notes is not null && request.Notes.Length > 500)
        {
            return EditExpenseResult.Failure(
                "VALIDATION_FAILED",
                "Note must be 500 characters or fewer."
            );
        }

        return null;
    }
}