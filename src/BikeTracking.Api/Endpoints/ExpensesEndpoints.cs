using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Endpoints;

public static class ExpensesEndpoints
{
    private static readonly FileExtensionContentTypeProvider ReceiptContentTypeProvider = new();

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

        group
            .MapPut("/{expenseId:long}", PutExpense)
            .WithName("EditExpense")
            .WithSummary("Edit an existing expense for the authenticated rider")
            .Produces<EditExpenseResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .RequireAuthorization();

        group
            .MapDelete("/{expenseId:long}", DeleteExpense)
            .WithName("DeleteExpense")
            .WithSummary("Delete an existing expense for the authenticated rider")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
            .RequireAuthorization();

        group
            .MapGet("/{expenseId:long}/receipt", GetExpenseReceipt)
            .WithName("GetExpenseReceipt")
            .WithSummary("Get the receipt for an expense owned by the authenticated rider")
            .Produces(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
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

    private static async Task<IResult> PutExpense(
        [FromRoute] long expenseId,
        [FromBody] EditExpenseRequest request,
        HttpContext context,
        [FromServices] EditExpenseService editExpenseService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var result = await editExpenseService.ExecuteAsync(
            riderId,
            expenseId,
            request,
            cancellationToken
        );

        if (result.IsSuccess && result.Response is not null)
        {
            return Results.Ok(result.Response);
        }

        var error =
            result.Error ?? new EditExpenseService.EditExpenseError("ERROR", "Unknown error.");

        return error.Code switch
        {
            "VALIDATION_FAILED" => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
            "EXPENSE_NOT_FOUND" => Results.NotFound(new ErrorResponse(error.Code, error.Message)),
            "EXPENSE_VERSION_CONFLICT" => Results.Conflict(
                new
                {
                    code = error.Code,
                    message = error.Message,
                    currentVersion = error.CurrentVersion,
                }
            ),
            _ => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
        };
    }

    private static async Task<IResult> DeleteExpense(
        [FromRoute] long expenseId,
        HttpContext context,
        DeleteExpenseService deleteExpenseService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var result = await deleteExpenseService.ExecuteAsync(riderId, expenseId, cancellationToken);

        if (result.IsSuccess)
        {
            return Results.NoContent();
        }

        var error =
            result.Error ?? new DeleteExpenseService.DeleteExpenseError("ERROR", "Unknown error.");

        return error.Code switch
        {
            "EXPENSE_NOT_FOUND" => Results.NotFound(new ErrorResponse(error.Code, error.Message)),
            "EXPENSE_ALREADY_DELETED" => Results.Conflict(
                new ErrorResponse(error.Code, error.Message)
            ),
            _ => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
        };
    }

    private static async Task<IResult> GetExpenseReceipt(
        [FromRoute] long expenseId,
        HttpContext context,
        BikeTrackingDbContext dbContext,
        IReceiptStorage receiptStorage,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var expense = await dbContext
            .Expenses.AsNoTracking()
            .Where(current => current.Id == expenseId)
            .SingleOrDefaultAsync(cancellationToken);

        if (
            expense is null
            || expense.RiderId != riderId
            || expense.IsDeleted
            || string.IsNullOrWhiteSpace(expense.ReceiptPath)
        )
        {
            return Results.NotFound(
                new ErrorResponse("EXPENSE_NOT_FOUND", $"Expense {expenseId} was not found.")
            );
        }

        try
        {
            var receiptStream = await receiptStorage.GetAsync(expense.ReceiptPath);
            var contentType = ResolveReceiptContentType(expense.ReceiptPath);
            return Results.File(receiptStream, contentType);
        }
        catch (FileNotFoundException)
        {
            return Results.NotFound(
                new ErrorResponse("RECEIPT_NOT_FOUND", $"Receipt for expense {expenseId} was not found.")
            );
        }
    }

    private static string ResolveReceiptContentType(string receiptPath)
    {
        return ReceiptContentTypeProvider.TryGetContentType(receiptPath, out var contentType)
            ? contentType
            : "application/octet-stream";
    }

}
