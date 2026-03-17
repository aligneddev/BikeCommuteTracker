using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace BikeTracking.Api.Endpoints;

public static class UsersEndpoints
{
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
}
