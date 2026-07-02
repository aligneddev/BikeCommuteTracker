using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class MonthlyImportEndpoints
{
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    public static IEndpointRouteBuilder MapMonthlyImportEndpoints(
        this IEndpointRouteBuilder endpoints
    )
    {
        var group = endpoints.MapGroup("/api/monthly-imports");

        group
            .MapPost("/preview", PostPreview)
            .WithName("PreviewMonthlyImport")
            .WithSummary("Upload and preview monthly summary import rows")
            .Produces<MonthlyImportPreviewResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapPost("/start", PostStart)
            .WithName("StartMonthlyImport")
            .WithSummary("Start processing a previewed monthly import")
            .Produces<ImportStartResponse>(StatusCodes.Status202Accepted)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
            .RequireAuthorization();

        group
            .MapGet("/{importJobId:long}/status", GetStatus)
            .WithName("GetMonthlyImportStatus")
            .WithSummary("Get current status for a monthly import job")
            .Produces<ImportStatusResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        group
            .MapPost("/{importJobId:long}/cancel", PostCancel)
            .WithName("CancelMonthlyImport")
            .WithSummary("Cancel a running monthly import job")
            .Produces<ImportCancelResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> PostPreview(
        [FromBody] MonthlyImportPreviewRequest request,
        HttpContext context,
        IMonthlySummaryImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        try
        {
            var decoded = Convert.FromBase64String(request.ContentBase64);
            if (decoded.Length > MaxUploadBytes)
            {
                return Results.BadRequest(
                    new ErrorResponse(
                        "VALIDATION_FAILED",
                        "Monthly summary file must be 5 MB or smaller."
                    )
                );
            }
        }
        catch (FormatException)
        {
            return Results.BadRequest(
                new ErrorResponse("VALIDATION_FAILED", "File content is not valid base64.")
            );
        }

        try
        {
            var response = await importService.PreviewAsync(riderId, request, cancellationToken);
            return Results.Ok(response);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", ex.Message));
        }
    }

    private static async Task<IResult> PostStart(
        [FromBody] ImportStartRequest request,
        HttpContext context,
        IMonthlySummaryImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        try
        {
            var response = await importService.StartAsync(riderId, request, cancellationToken);
            return Results.Accepted(
                $"/api/monthly-imports/{response.ImportJobId}/status",
                response
            );
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", ex.Message));
        }
        catch (ImportConflictException ex)
        {
            return Results.Conflict(new ErrorResponse("CONFLICT", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Results.NotFound(new ErrorResponse("NOT_FOUND", ex.Message));
        }
    }

    private static async Task<IResult> GetStatus(
        long importJobId,
        HttpContext context,
        IMonthlySummaryImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        var response = await importService.GetStatusAsync(riderId, importJobId, cancellationToken);
        return response is null
            ? Results.NotFound(new ErrorResponse("NOT_FOUND", "Import job was not found."))
            : Results.Ok(response);
    }

    private static async Task<IResult> PostCancel(
        long importJobId,
        HttpContext context,
        IMonthlySummaryImportService importService,
        CancellationToken cancellationToken
    )
    {
        if (!TryGetRiderId(context, out var riderId))
        {
            return Results.Unauthorized();
        }

        var response = await importService.CancelAsync(riderId, importJobId, cancellationToken);
        return response is null
            ? Results.NotFound(new ErrorResponse("NOT_FOUND", "Import job was not found."))
            : Results.Ok(response);
    }

    private static bool TryGetRiderId(HttpContext context, out long riderId)
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        return long.TryParse(userIdString, out riderId) && riderId > 0;
    }
}
