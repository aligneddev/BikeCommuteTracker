using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class RidesEndpoints
{
    public static IEndpointRouteBuilder MapRidesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/rides");

        group
            .MapPost("/", PostRecordRide)
            .WithName("RecordRide")
            .WithSummary("Record a new ride event")
            .Produces<RecordRideSuccessResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapGet("/defaults", GetRideDefaults)
            .WithName("GetRideDefaults")
            .WithSummary("Get record-ride form defaults")
            .Produces<RideDefaultsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> PostRecordRide(
        [FromBody] RecordRideRequest request,
        HttpContext context,
        RecordRideService recordRideService,
        CancellationToken cancellationToken
    )
    {
        try
        {
            // Get authenticated user ID from context
            var userIdString = context.User.FindFirst("sub")?.Value;
            if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
                return Results.Unauthorized();

            var (rideId, eventPayload) = await recordRideService.ExecuteAsync(
                riderId,
                request,
                cancellationToken
            );

            var response = new RecordRideSuccessResponse(
                RideId: rideId,
                RiderId: riderId,
                SavedAtUtc: DateTime.UtcNow,
                EventStatus: "Queued"
            );

            return Results.Created($"/api/rides/{rideId}", response);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse("VALIDATION_FAILED", ex.Message));
        }
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while recording the ride")
            );
        }
    }

    private static async Task<IResult> GetRideDefaults(
        HttpContext context,
        GetRideDefaultsService getDefaultsService,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var userIdString = context.User.FindFirst("sub")?.Value;
            if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
                return Results.Unauthorized();

            var defaults = await getDefaultsService.ExecuteAsync(riderId, cancellationToken);
            return Results.Ok(defaults);
        }
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while retrieving defaults")
            );
        }
    }
}
