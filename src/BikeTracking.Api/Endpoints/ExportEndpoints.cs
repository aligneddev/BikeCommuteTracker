using BikeTracking.Api.Application.Export;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http.HttpResults;

namespace BikeTracking.Api.Endpoints;

public static class ExportEndpoints
{
    public static IEndpointRouteBuilder MapExportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/exports").RequireAuthorization();

        group
            .MapGet("/expenses", GetExpensesCsv)
            .WithName("ExportExpensesCsv")
            .WithSummary("Export all expense records for the authenticated rider as CSV")
            .Produces<FileContentHttpResult>(StatusCodes.Status200OK, "text/csv")
            .Produces(StatusCodes.Status401Unauthorized);

        group
            .MapGet("/rides", GetRideHistoryZip)
            .WithName("ExportRideHistoryZip")
            .WithSummary("Export all ride records for the authenticated rider as a per-year ZIP archive")
            .Produces<FileStreamHttpResult>(StatusCodes.Status200OK, "application/zip")
            .Produces(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static async Task<IResult> GetExpensesCsv(
        HttpContext context,
        ExpenseCsvExportService exportService,
        CancellationToken cancellationToken
    )
    {
        if (!context.User.TryGetRiderId(out var riderId))
        {
            return Results.Unauthorized();
        }

        var csv = await exportService.ExportAsync(riderId, cancellationToken);
        var bytes = System.Text.Encoding.UTF8.GetBytes(csv);

        return Results.File(
            bytes,
            contentType: "text/csv; charset=utf-8",
            fileDownloadName: "expenses-export.csv"
        );
    }

    private static async Task<IResult> GetRideHistoryZip(
        HttpContext context,
        RideHistoryCsvExportService exportService,
        CancellationToken cancellationToken
    )
    {
        if (!context.User.TryGetRiderId(out var riderId))
        {
            return Results.Unauthorized();
        }

        var stream = await exportService.ExportAsync(riderId, cancellationToken);

        return Results.File(
            stream,
            contentType: "application/zip",
            fileDownloadName: "ride-history-export.zip"
        );
    }
}
