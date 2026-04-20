using System.Text;
using BikeTracking.Api.Application.ExpenseImports;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class ExpenseImportEndpoints
{
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    public static IEndpointRouteBuilder MapExpenseImportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/expense-imports");

        group
            .MapPost("/preview", PostPreview)
            .Produces<ExpenseImportPreviewResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapPost("/{jobId:long}/confirm", PostConfirm)
            .Produces<ExpenseImportSummaryResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
            .RequireAuthorization();

        group
            .MapGet("/{jobId:long}/status", GetStatus)
            .Produces<ExpenseImportStatusResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        group
            .MapDelete("/{jobId:long}", Delete)
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        return endpoints;
    }

    private static Task<IResult> PostPreview(
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        return PostPreviewCore(context, importService, cancellationToken);
    }

    private static Task<IResult> PostConfirm(
        long jobId,
        [FromBody] ConfirmExpenseImportRequest request,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        return PostConfirmCore(jobId, request, context, importService, cancellationToken);
    }

    private static Task<IResult> GetStatus(
        long jobId,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        return GetStatusCore(jobId, context, importService, cancellationToken);
    }

    private static Task<IResult> Delete(
        long jobId,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        return DeleteCore(jobId, context, importService, cancellationToken);
    }

    private static async Task<IResult> PostPreviewCore(
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        var form = await context.Request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("file");
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", "A CSV file is required."));
        }

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", "Please upload a .csv file."));
        }

        if (file.Length > MaxUploadBytes)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", "CSV file must be 5 MB or smaller."));
        }

        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var csvText = await reader.ReadToEndAsync(cancellationToken);

        try
        {
            var response = await importService.PreviewAsync(riderId, file.FileName, csvText, cancellationToken);
            return Results.Ok(response);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", exception.Message));
        }
    }

    private static async Task<IResult> PostConfirmCore(
        long jobId,
        ConfirmExpenseImportRequest request,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        return ToResult(await importService.ConfirmAsync(riderId, jobId, request, cancellationToken));
    }

    private static async Task<IResult> GetStatusCore(
        long jobId,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        return ToResult(await importService.GetStatusAsync(riderId, jobId, cancellationToken));
    }

    private static async Task<IResult> DeleteCore(
        long jobId,
        HttpContext context,
        CsvExpenseImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        var result = await importService.DeleteAsync(riderId, jobId, cancellationToken);
        return result.IsSuccess ? Results.NoContent() : ErrorToResult(result.Error!);
    }

    private static bool TryGetRiderId(HttpContext context, out long riderId)
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        return long.TryParse(userIdString, out riderId) && riderId > 0;
    }

    private static IResult ToResult<T>(CsvExpenseImportService.OperationResult<T> result)
    {
        return result.IsSuccess ? Results.Ok(result.Value) : ErrorToResult(result.Error!);
    }

    private static IResult ErrorToResult(CsvExpenseImportService.OperationError error)
    {
        return error.StatusCode switch
        {
            StatusCodes.Status400BadRequest => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
            StatusCodes.Status403Forbidden => Results.Json(
                new ErrorResponse(error.Code, error.Message),
                statusCode: StatusCodes.Status403Forbidden
            ),
            StatusCodes.Status404NotFound => Results.NotFound(new ErrorResponse(error.Code, error.Message)),
            StatusCodes.Status409Conflict => Results.Conflict(new ErrorResponse(error.Code, error.Message)),
            _ => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
        };
    }
}