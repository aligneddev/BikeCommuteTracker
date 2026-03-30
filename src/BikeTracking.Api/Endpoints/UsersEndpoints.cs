using System.Text.Json;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class UsersEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var usersGroup = endpoints.MapGroup("/api/users");

        usersGroup
            .MapPost("/signup", SignupAsync)
            .WithName("SignupUser")
            .WithSummary("Create a local user with name and PIN")
            .Produces<SignupSuccessResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);

        usersGroup
            .MapPost("/identify", IdentifyAsync)
            .WithName("IdentifyUser")
            .WithSummary("Identify local user by normalized name and PIN")
            .Produces<IdentifySuccessResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .Produces<ThrottleResponse>(StatusCodes.Status429TooManyRequests);

        var meGroup = endpoints.MapGroup("/api/users/me").RequireAuthorization();

        meGroup
            .MapGet("/settings", GetUserSettings)
            .WithName("GetUserSettings")
            .WithSummary("Get per-user settings for the authenticated rider")
            .Produces<UserSettingsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        meGroup
            .MapPut("/settings", PutUserSettings)
            .WithName("PutUserSettings")
            .WithSummary("Save per-user settings for the authenticated rider")
            .Produces<UserSettingsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static async Task<IResult> SignupAsync(
        [FromBody] SignupRequest request,
        SignupService signupService,
        CancellationToken cancellationToken
    )
    {
        var result = await signupService.SignupAsync(request, cancellationToken);

        if (result.IsSuccess && result.Response is not null)
        {
            return Results.Created($"/api/users/{result.Response.UserId}", result.Response);
        }

        if (result.IsDuplicateName && result.Error is not null)
        {
            return Results.Conflict(result.Error);
        }

        return Results.BadRequest(
            result.Error
                ?? new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
        );
    }

    private static async Task<IResult> IdentifyAsync(
        [FromBody] IdentifyRequest request,
        IdentifyService identifyService,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var result = await identifyService.IdentifyAsync(request, cancellationToken);

        return result.ResultType switch
        {
            IdentifyResultType.Success when result.Response is not null => Results.Ok(
                result.Response
            ),
            IdentifyResultType.ValidationFailed => Results.BadRequest(result.Error),
            IdentifyResultType.Unauthorized => Results.Unauthorized(),
            IdentifyResultType.Throttled => ToThrottleResult(result, httpContext),
            _ => Results.BadRequest(
                new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
            ),
        };
    }

    private static IResult ToThrottleResult(IdentifyResult result, HttpContext httpContext)
    {
        httpContext.Response.Headers.Append("Retry-After", result.RetryAfterSeconds.ToString());

        var payload = new ThrottleResponse(
            UsersErrorCodes.Throttled,
            result.Error?.Message ?? "Too many attempts. Try again later.",
            result.RetryAfterSeconds
        );

        return Results.Json(payload, statusCode: StatusCodes.Status429TooManyRequests);
    }

    private static async Task<IResult> GetUserSettings(
        HttpContext context,
        UserSettingsService userSettingsService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        var result = await userSettingsService.GetAsync(riderId, cancellationToken);
        if (result.IsSuccess && result.Response is not null)
            return Results.Ok(result.Response);

        return Results.BadRequest(
            result.Error
                ?? new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
        );
    }

    private static async Task<IResult> PutUserSettings(
        HttpContext context,
        [FromBody] JsonElement requestBody,
        UserSettingsService userSettingsService,
        CancellationToken cancellationToken
    )
    {
        var userIdString = context.User.FindFirst("sub")?.Value;
        if (!long.TryParse(userIdString, out var riderId) || riderId <= 0)
            return Results.Unauthorized();

        if (requestBody.ValueKind is not JsonValueKind.Object)
        {
            return Results.BadRequest(
                new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
            );
        }

        var request = requestBody.Deserialize<UserSettingsUpsertRequest>(JsonOptions);
        if (request is null)
        {
            return Results.BadRequest(
                new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
            );
        }

        var providedFields = requestBody
            .EnumerateObject()
            .Select(x => x.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = await userSettingsService.SaveAsync(
            riderId,
            request,
            cancellationToken,
            providedFields
        );
        if (result.IsSuccess && result.Response is not null)
            return Results.Ok(result.Response);

        return Results.BadRequest(
            result.Error
                ?? new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.")
        );
    }
}
