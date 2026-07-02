using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints
            .MapGet("/api/dashboard", GetDashboardAsync)
            .RequireAuthorization()
            .WithName("GetDashboard")
            .WithSummary("Get the authenticated rider dashboard")
            .Produces<DashboardResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        endpoints
            .MapGet("/api/dashboard/advanced", GetAdvancedDashboardAsync)
            .RequireAuthorization()
            .WithName("GetAdvancedDashboard")
            .WithSummary("Get the authenticated rider advanced statistics dashboard")
            .Produces<AdvancedDashboardResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        endpoints
            .MapGet("/api/dashboard/year-stats", GetYearStatsDashboardAsync)
            .RequireAuthorization()
            .WithName("GetYearStatsDashboard")
            .WithSummary("Get the authenticated rider's dashboard scoped to a single calendar year")
            .Produces<YearStatsDashboardResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        endpoints
            .MapGet("/api/dashboard/year-stats/years", GetAvailableYearsAsync)
            .RequireAuthorization()
            .WithName("GetAvailableYears")
            .WithSummary("Get the distinct calendar years selectable in the year stats dashboard")
            .Produces<AvailableYearsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static async Task<IResult> GetDashboardAsync(
        HttpContext context,
        [FromServices] GetDashboardService dashboardService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var response = await dashboardService.GetAsync(riderId, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetAdvancedDashboardAsync(
        HttpContext context,
        [FromServices] GetAdvancedDashboardService advancedDashboardService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var response = await advancedDashboardService.GetAsync(riderId, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetYearStatsDashboardAsync(
        HttpContext context,
        [FromQuery] string? year,
        [FromServices] GetYearStatsDashboardService yearStatsDashboardService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var minYear = 1900;
        var maxYear = DateTime.Now.Year + 1;

        if (!int.TryParse(year, out var parsedYear) || parsedYear < minYear || parsedYear > maxYear)
        {
            return Results.BadRequest(
                new ErrorResponse(
                    "INVALID_YEAR",
                    $"year must be a 4-digit integer between {minYear} and {maxYear}."
                )
            );
        }

        var response = await yearStatsDashboardService.GetAsync(
            riderId,
            parsedYear,
            cancellationToken
        );
        return Results.Ok(response);
    }

    private static async Task<IResult> GetAvailableYearsAsync(
        HttpContext context,
        [FromServices] GetYearStatsDashboardService yearStatsDashboardService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
        {
            return Results.Unauthorized();
        }

        var response = await yearStatsDashboardService.GetAvailableYearsAsync(
            riderId,
            cancellationToken
        );
        return Results.Ok(response);
    }
}
