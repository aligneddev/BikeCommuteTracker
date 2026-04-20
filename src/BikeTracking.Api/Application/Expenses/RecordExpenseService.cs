using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp.Expenses;
using Microsoft.FSharp.Core;
using Microsoft.FSharp.Reflection;

namespace BikeTracking.Api.Application.Expenses;

public sealed class RecordExpenseService(
    BikeTrackingDbContext dbContext,
    IReceiptStorage receiptStorage,
    ILogger<RecordExpenseService> logger
)
{
    public async Task<RecordExpenseResponse> ExecuteAsync(
        long riderId,
        RecordExpenseRequest request,
        string? receiptFileName = null,
        Stream? receiptStream = null,
        CancellationToken cancellationToken = default
    )
    {
        var validatedAmount = EnsureValid(
            ExpenseEvents.validateAmount(request.Amount),
            nameof(request)
        );
        var validatedDate = EnsureValid(
            ExpenseEvents.validateDate(request.ExpenseDate),
            nameof(request)
        );
        var noteOption = request.Notes is null
            ? FSharpOption<string>.None
            : FSharpOption<string>.Some(request.Notes);
        var validatedNotesOption = EnsureValid(
            ExpenseEvents.validateNotes(noteOption),
            nameof(request)
        );

        var now = DateTime.UtcNow;
        var expense = new ExpenseEntity
        {
            RiderId = riderId,
            ExpenseDate = validatedDate,
            Amount = validatedAmount,
            Notes = validatedNotesOption?.Value,
            IsDeleted = false,
            Version = 1,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        dbContext.Expenses.Add(expense);
        await dbContext.SaveChangesAsync(cancellationToken);

        var receiptAttached = false;
        string? receiptError = null;
        if (!string.IsNullOrWhiteSpace(receiptFileName) && receiptStream is not null)
        {
            try
            {
                expense.ReceiptPath = await receiptStorage.SaveAsync(
                    riderId,
                    expense.Id,
                    receiptFileName,
                    receiptStream
                );
                expense.UpdatedAtUtc = DateTime.UtcNow;
                await dbContext.SaveChangesAsync(cancellationToken);
                receiptAttached = true;
            }
            catch (IOException ex)
            {
                logger.LogError(
                    ex,
                    "Receipt upload failed for riderId={RiderId}, expenseId={ExpenseId}: I/O or disk error — {Reason}",
                    riderId,
                    expense.Id,
                    ex.Message
                );
                receiptError =
                    "Receipt could not be saved due to a storage error. The expense has been recorded without the receipt.";
            }
            catch (UnauthorizedAccessException ex)
            {
                logger.LogError(
                    ex,
                    "Receipt upload failed for riderId={RiderId}, expenseId={ExpenseId}: permission denied — {Reason}",
                    riderId,
                    expense.Id,
                    ex.Message
                );
                receiptError =
                    "Receipt could not be saved due to a permission error. The expense has been recorded without the receipt.";
            }
        }

        return new RecordExpenseResponse(
            expense.Id,
            riderId,
            expense.UpdatedAtUtc,
            receiptAttached,
            receiptError
        );
    }

    private static T EnsureValid<T>(FSharpResult<T, string> validationResult, string paramName)
    {
        var union = FSharpValue.GetUnionFields(
            validationResult,
            typeof(FSharpResult<T, string>),
            null
        );
        if (union.Item1.Name == "Ok")
        {
            return (T)union.Item2[0];
        }

        throw new ArgumentException((string)union.Item2[0], paramName);
    }
}
