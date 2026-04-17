using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Endpoints;

public static class ExpensesEndpoints
{
    private static readonly HashSet<string> AllowedReceiptContentTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    ];

    public static IEndpointRouteBuilder MapExpensesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/expenses");

        group
            .MapPost("", PostExpense)
            .WithName("RecordExpense")
            .WithSummary("Record a new expense")
            .Produces<RecordExpenseResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status422UnprocessableEntity)
            .RequireAuthorization();

        group
            .MapGet("", GetExpenses)
            .WithName("GetExpenses")
            .WithSummary("Get expense history for authenticated rider")
            .Produces<ExpenseHistoryResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> PostExpense(
        HttpContext context,
        RecordExpenseService recordExpenseService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var form = await context.Request.ReadFormAsync(cancellationToken);
        var expenseDateValue = form["expenseDate"].ToString();
        var amountValue = form["amount"].ToString();
        var notes = form["notes"].ToString();

        if (!DateTime.TryParse(expenseDateValue, out var expenseDate))
        {
            return Results.BadRequest(
                new ErrorResponse("VALIDATION_FAILED", "Expense date is required")
            );
        }

        if (!decimal.TryParse(amountValue, out var amount))
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", "Amount is required"));
        }

        var receipt = form.Files.GetFile("receipt");
        if (receipt is not null && !AllowedReceiptContentTypes.Contains(receipt.ContentType))
        {
            return Results.UnprocessableEntity(
                new ErrorResponse(
                    "UNSUPPORTED_RECEIPT",
                    "Receipt must be JPEG, PNG, WEBP, or PDF and no larger than 5 MB"
                )
            );
        }

        try
        {
            var request = new RecordExpenseRequest(
                expenseDate,
                amount,
                string.IsNullOrWhiteSpace(notes) ? null : notes
            );

            await using var receiptStream = receipt?.OpenReadStream();
            var response = await recordExpenseService.ExecuteAsync(
                riderId,
                request,
                receipt?.FileName,
                receiptStream,
                cancellationToken
            );

            return Results.Created($"/api/expenses/{response.ExpenseId}", response);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", ex.Message));
        }
    }

    private static async Task<IResult> GetExpenses(
        HttpContext context,
        BikeTrackingDbContext dbContext,
        string? startDate,
        string? endDate,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        DateTime? parsedStartDate = null;
        if (!string.IsNullOrWhiteSpace(startDate))
        {
            if (!DateTime.TryParse(startDate, out var parsed))
            {
                return Results.BadRequest(
                    new ErrorResponse("VALIDATION_FAILED", "startDate must be a valid date")
                );
            }

            parsedStartDate = parsed.Date;
        }

        DateTime? parsedEndDate = null;
        if (!string.IsNullOrWhiteSpace(endDate))
        {
            if (!DateTime.TryParse(endDate, out var parsed))
            {
                return Results.BadRequest(
                    new ErrorResponse("VALIDATION_FAILED", "endDate must be a valid date")
                );
            }

            parsedEndDate = parsed.Date;
        }

        var query = dbContext
            .Expenses.AsNoTracking()
            .Where(expense => expense.RiderId == riderId && !expense.IsDeleted);

        if (parsedStartDate.HasValue)
        {
            query = query.Where(expense => expense.ExpenseDate >= parsedStartDate.Value);
        }

        if (parsedEndDate.HasValue)
        {
            query = query.Where(expense => expense.ExpenseDate <= parsedEndDate.Value);
        }

        var expenses = await query
            .OrderByDescending(expense => expense.ExpenseDate)
            .ThenByDescending(expense => expense.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var rows = expenses
            .Select(expense => new ExpenseHistoryRow(
                ExpenseId: expense.Id,
                ExpenseDate: expense.ExpenseDate,
                Amount: expense.Amount,
                Notes: expense.Notes,
                HasReceipt: !string.IsNullOrWhiteSpace(expense.ReceiptPath),
                Version: expense.Version,
                CreatedAtUtc: expense.CreatedAtUtc
            ))
            .ToList();

        var response = new ExpenseHistoryResponse(
            Expenses: rows,
            TotalAmount: rows.Sum(row => row.Amount),
            ExpenseCount: rows.Count,
            GeneratedAtUtc: DateTime.UtcNow
        );

        return Results.Ok(response);
    }
}
