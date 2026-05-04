using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Endpoints;

public static class RidesEndpoints
{
    private const string EiaGasPriceSource = "Source: U.S. Energy Information Administration (EIA)";

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
            .MapGet("/gas-price", GetGasPrice)
            .WithName("GetGasPrice")
            .WithSummary("Get gas price lookup for a date")
            .Produces<GasPriceResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapGet("/weather", GetRideWeather)
            .WithName("GetRideWeather")
            .WithSummary("Get weather preview for a ride timestamp")
            .Produces<RideWeatherResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapGet("/presets", GetRidePresets)
            .WithName("GetRidePresets")
            .WithSummary("Get ride presets for the authenticated rider")
            .Produces<RidePresetsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapPost("/presets", PostRidePreset)
            .WithName("CreateRidePreset")
            .WithSummary("Create a new ride preset for the authenticated rider")
            .Produces<RidePresetDto>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group
            .MapPut("/presets/{presetId:long}", PutRidePreset)
            .WithName("UpdateRidePreset")
            .WithSummary("Update a ride preset for the authenticated rider")
            .Produces<RidePresetDto>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        group
            .MapDelete("/presets/{presetId:long}", DeleteRidePreset)
            .WithName("DeleteRidePreset")
            .WithSummary("Delete a ride preset for the authenticated rider")
            .Produces<DeleteRidePresetResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
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

        group
            .MapGet("/csv-sample", GetCsvSample)
            .WithName("GetCsvSample")
            .WithSummary("Download a sample CSV file for ride import")
            .Produces(StatusCodes.Status200OK, contentType: "text/csv")
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> GetRidePresets(
        HttpContext context,
        [FromServices] IRidePresetService ridePresetService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        var response = await ridePresetService.ListAsync(riderId, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> PostRidePreset(
        HttpContext context,
        [FromBody] UpsertRidePresetRequest request,
        [FromServices] IRidePresetService ridePresetService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        var normalizedRequest = NormalizePresetRequest(request);
        var validation = ValidatePresetRequest(normalizedRequest);
        if (validation is not null)
            return Results.BadRequest(validation);

        var result = await ridePresetService.CreateAsync(
            riderId,
            normalizedRequest,
            cancellationToken
        );
        if (result.IsSuccess && result.Preset is not null)
        {
            return Results.Created($"/api/rides/presets/{result.Preset.PresetId}", result.Preset);
        }

        return Results.BadRequest(
            result.Error ?? new ErrorResponse("ERROR", "Failed to create preset.")
        );
    }

    private static async Task<IResult> PutRidePreset(
        [FromRoute] long presetId,
        HttpContext context,
        [FromBody] UpsertRidePresetRequest request,
        [FromServices] IRidePresetService ridePresetService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        var normalizedRequest = NormalizePresetRequest(request);
        var validation = ValidatePresetRequest(normalizedRequest);
        if (validation is not null)
            return Results.BadRequest(validation);

        var result = await ridePresetService.UpdateAsync(
            riderId,
            presetId,
            normalizedRequest,
            cancellationToken
        );

        if (result.IsSuccess && result.Preset is not null)
        {
            return Results.Ok(result.Preset);
        }

        var error = result.Error ?? new ErrorResponse("ERROR", "Failed to update preset.");
        return error.Code == "PRESET_NOT_FOUND"
            ? Results.NotFound(error)
            : Results.BadRequest(error);
    }

    private static async Task<IResult> DeleteRidePreset(
        [FromRoute] long presetId,
        HttpContext context,
        [FromServices] IRidePresetService ridePresetService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        var result = await ridePresetService.DeleteAsync(riderId, presetId, cancellationToken);
        if (result.IsSuccess && result.Response is not null)
        {
            return Results.Ok(result.Response);
        }

        var error = result.Error ?? new ErrorResponse("ERROR", "Failed to delete preset.");
        return error.Code == "PRESET_NOT_FOUND"
            ? Results.NotFound(error)
            : Results.BadRequest(error);
    }

    private static UpsertRidePresetRequest NormalizePresetRequest(UpsertRidePresetRequest request)
    {
        return request with
        {
            Name = request.Name.Trim(),
            PrimaryDirection = request.PrimaryDirection.Trim(),
            PeriodTag = request.PeriodTag.Trim().ToLowerInvariant(),
            ExactStartTimeLocal = request.ExactStartTimeLocal.Trim(),
        };
    }

    private static ErrorResponse? ValidatePresetRequest(UpsertRidePresetRequest request)
    {
        if (request.Name.Length is < 1 or > 80)
        {
            return new ErrorResponse(
                "VALIDATION_FAILED",
                "Preset name must be between 1 and 80 characters."
            );
        }

        if (request.PeriodTag is not ("morning" or "afternoon"))
        {
            return new ErrorResponse(
                "VALIDATION_FAILED",
                "Period tag must be 'morning' or 'afternoon'."
            );
        }

        if (!TimeOnly.TryParseExact(request.ExactStartTimeLocal, "HH:mm", out _))
        {
            return new ErrorResponse(
                "VALIDATION_FAILED",
                "Exact start time must be in HH:mm format."
            );
        }

        if (request.DurationMinutes is < 1 or > 1440)
        {
            return new ErrorResponse(
                "VALIDATION_FAILED",
                "Duration minutes must be between 1 and 1440."
            );
        }

        return null;
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

    private static async Task<IResult> GetGasPrice(
        HttpContext context,
        [FromQuery] string? date,
        [FromServices] IGasPriceLookupService gasPriceLookupService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var parsedDate))
        {
            return Results.BadRequest(
                new ErrorResponse(
                    "INVALID_REQUEST",
                    "date query parameter is required and must be a valid date in YYYY-MM-DD format."
                )
            );
        }

        try
        {
            var price = await gasPriceLookupService.GetOrFetchAsync(parsedDate, cancellationToken);
            return Results.Ok(
                new GasPriceResponse(
                    Date: parsedDate.ToString("yyyy-MM-dd"),
                    PricePerGallon: price,
                    IsAvailable: price.HasValue,
                    DataSource: price.HasValue ? EiaGasPriceSource : null
                )
            );
        }
        catch
        {
            return Results.Ok(
                new GasPriceResponse(
                    Date: parsedDate.ToString("yyyy-MM-dd"),
                    PricePerGallon: null,
                    IsAvailable: false,
                    DataSource: null
                )
            );
        }
    }

    private static async Task<IResult> GetRideWeather(
        HttpContext context,
        [FromQuery] string? rideDateTimeLocal,
        [FromServices] BikeTrackingDbContext dbContext,
        [FromServices] IWeatherLookupService weatherLookupService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        if (
            string.IsNullOrWhiteSpace(rideDateTimeLocal)
            || !DateTime.TryParse(rideDateTimeLocal, out var parsedRideDateTimeLocal)
        )
        {
            return Results.BadRequest(
                new ErrorResponse(
                    "INVALID_REQUEST",
                    "rideDateTimeLocal query parameter is required and must be a valid date time."
                )
            );
        }

        try
        {
            var userSettings = await dbContext
                .UserSettings.AsNoTracking()
                .SingleOrDefaultAsync(settings => settings.UserId == riderId, cancellationToken);

            if (
                userSettings?.Latitude is not decimal latitude
                || userSettings.Longitude is not decimal longitude
            )
            {
                return Results.Ok(
                    new RideWeatherResponse(
                        RideDateTimeLocal: parsedRideDateTimeLocal,
                        Temperature: null,
                        WindSpeedMph: null,
                        WindDirectionDeg: null,
                        RelativeHumidityPercent: null,
                        CloudCoverPercent: null,
                        PrecipitationType: null,
                        IsAvailable: false
                    )
                );
            }

            var weather = await weatherLookupService.GetOrFetchAsync(
                latitude,
                longitude,
                parsedRideDateTimeLocal.ToUniversalTime(),
                cancellationToken
            );

            return Results.Ok(
                new RideWeatherResponse(
                    RideDateTimeLocal: parsedRideDateTimeLocal,
                    Temperature: weather?.Temperature,
                    WindSpeedMph: weather?.WindSpeedMph,
                    WindDirectionDeg: weather?.WindDirectionDeg,
                    RelativeHumidityPercent: weather?.RelativeHumidityPercent,
                    CloudCoverPercent: weather?.CloudCoverPercent,
                    PrecipitationType: weather?.PrecipitationType,
                    IsAvailable: weather is not null
                )
            );
        }
        catch
        {
            return Results.Ok(
                new RideWeatherResponse(
                    RideDateTimeLocal: parsedRideDateTimeLocal,
                    Temperature: null,
                    WindSpeedMph: null,
                    WindDirectionDeg: null,
                    RelativeHumidityPercent: null,
                    CloudCoverPercent: null,
                    PrecipitationType: null,
                    IsAvailable: false
                )
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

    private static IResult GetCsvSample()
    {
        var csv = SampleCsvGenerator.Generate();
        var bytes = System.Text.Encoding.UTF8.GetBytes(csv);
        return Results.File(
            bytes,
            contentType: "text/csv",
            fileDownloadName: "ride-import-sample.csv"
        );
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
