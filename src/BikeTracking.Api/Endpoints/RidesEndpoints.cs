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

        group
            .MapGet("/quick-options", GetQuickRideOptions)
            .WithName("GetQuickRideOptions")
            .WithSummary("Get quick ride options for the authenticated rider")
            .Produces<QuickRideOptionsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapGet("/history", GetRideHistory)
            .WithName("GetRideHistory")
            .WithSummary("Get authenticated rider ride history with summaries and filtering")
            .Produces<RideHistoryResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapPut("/{rideId:long}", PutEditRide)
            .WithName("EditRide")
            .WithSummary("Edit an existing ride for the authenticated rider")
            .Produces<EditRideResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
            .RequireAuthorization();

        group
            .MapDelete("/{rideId:long}", DeleteRide)
            .WithName("DeleteRide")
            .WithSummary("Delete an existing ride for the authenticated rider")
            .Produces<DeleteRideResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
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

    private static async Task<IResult> GetRideHistory(
        HttpContext context,
        GetRideHistoryService historyService,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var userIdString = context.User.FindFirst("sub")?.Value;
            if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
                return Results.Unauthorized();

            // Parse date query parameters
            DateOnly? fromDate = null,
                toDate = null;

            if (!string.IsNullOrWhiteSpace(from) && DateOnly.TryParse(from, out var parsedFrom))
                fromDate = parsedFrom;

            if (!string.IsNullOrWhiteSpace(to) && DateOnly.TryParse(to, out var parsedTo))
                toDate = parsedTo;

            var response = await historyService.GetRideHistoryAsync(
                riderId,
                fromDate,
                toDate,
                page,
                pageSize,
                cancellationToken
            );

            return Results.Ok(response);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse("INVALID_DATE_RANGE", ex.Message));
        }
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while retrieving ride history")
            );
        }
    }

    private static async Task<IResult> GetQuickRideOptions(
        HttpContext context,
        GetQuickRideOptionsService quickRideOptionsService,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var userIdString = context.User.FindFirst("sub")?.Value;
            if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
                return Results.Unauthorized();

            var response = await quickRideOptionsService.ExecuteAsync(riderId, cancellationToken);
            return Results.Ok(response);
        }
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while retrieving quick ride options")
            );
        }
    }

    private static async Task<IResult> PutEditRide(
        [FromRoute] long rideId,
        [FromBody] EditRideRequest request,
        HttpContext context,
        [FromServices] EditRideService editRideService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        try
        {
            var result = await editRideService.ExecuteAsync(
                riderId,
                rideId,
                request,
                cancellationToken
            );

            if (result.IsSuccess && result.Response is not null)
            {
                return Results.Ok(result.Response);
            }

            var error =
                result.Error ?? new EditRideService.EditRideError("ERROR", "Unknown error.");

            return error.Code switch
            {
                "VALIDATION_FAILED" => Results.BadRequest(
                    new ErrorResponse(error.Code, error.Message)
                ),
                "FORBIDDEN" => Results.Json(
                    new ErrorResponse(error.Code, error.Message),
                    statusCode: StatusCodes.Status403Forbidden
                ),
                "RIDE_NOT_FOUND" => Results.NotFound(new ErrorResponse(error.Code, error.Message)),
                "RIDE_VERSION_CONFLICT" => Results.Conflict(
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
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while editing the ride")
            );
        }
    }

    private static async Task<IResult> DeleteRide(
        [FromRoute] long rideId,
        HttpContext context,
        [FromServices] DeleteRideService deleteRideService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        try
        {
            var result = await deleteRideService.ExecuteAsync(riderId, rideId);

            if (result.IsSuccess && result.Response is not null)
            {
                return Results.Ok(result.Response);
            }

            var error =
                result.Error ?? new DeleteRideService.DeleteRideError("ERROR", "Unknown error.");

            return error.Code switch
            {
                "RIDE_NOT_FOUND" => Results.NotFound(new ErrorResponse(error.Code, error.Message)),
                "NOT_RIDE_OWNER" => Results.Json(
                    new ErrorResponse(error.Code, error.Message),
                    statusCode: StatusCodes.Status403Forbidden
                ),
                _ => Results.BadRequest(new ErrorResponse(error.Code, error.Message)),
            };
        }
        catch
        {
            return Results.BadRequest(
                new ErrorResponse("ERROR", "An error occurred while deleting the ride")
            );
        }
    }
}
