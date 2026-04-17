using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Expenses;

public sealed class DeleteExpenseService(
    BikeTrackingDbContext dbContext,
    IReceiptStorage receiptStorage,
    ILogger<DeleteExpenseService> logger
)
{
    public sealed record DeleteExpenseError(string Code, string Message);

    public sealed record DeleteExpenseResult(
        bool IsSuccess,
        DeleteExpenseResponse? Response,
        DeleteExpenseError? Error
    )
    {
        public static DeleteExpenseResult Success(DeleteExpenseResponse response)
        {
            return new DeleteExpenseResult(true, response, null);
        }

        public static DeleteExpenseResult Failure(string code, string message)
        {
            return new DeleteExpenseResult(false, null, new DeleteExpenseError(code, message));
        }
    }

    public async Task<DeleteExpenseResult> ExecuteAsync(
        long riderId,
        long expenseId,
        CancellationToken cancellationToken = default
    )
    {
        var expense = await dbContext
            .Expenses.Where(current => current.Id == expenseId)
            .SingleOrDefaultAsync(cancellationToken);

        if (expense is null || expense.RiderId != riderId)
        {
            return DeleteExpenseResult.Failure(
                "EXPENSE_NOT_FOUND",
                $"Expense {expenseId} was not found."
            );
        }

        if (expense.IsDeleted)
        {
            return DeleteExpenseResult.Failure(
                "EXPENSE_ALREADY_DELETED",
                $"Expense {expenseId} was already deleted."
            );
        }

        if (!string.IsNullOrWhiteSpace(expense.ReceiptPath))
        {
            await receiptStorage.DeleteAsync(expense.ReceiptPath);
        }

        expense.IsDeleted = true;
        expense.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Deleted expense {ExpenseId} for rider {RiderId}",
            expense.Id,
            riderId
        );

        return DeleteExpenseResult.Success(
            new DeleteExpenseResponse(expense.Id, expense.UpdatedAtUtc)
        );
    }
}
