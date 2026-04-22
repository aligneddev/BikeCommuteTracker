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
}
