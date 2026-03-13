using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Application.Users;

public sealed class IdentifyService(
    BikeTrackingDbContext dbContext,
    PinPolicyValidator pinPolicyValidator,
    IPinHasher pinHasher,
    IOptions<IdentityOptions> identityOptions)
{
    private readonly ThrottleOptions _throttleOptions = identityOptions.Value.Throttle;

    public async Task<IdentifyResult> IdentifyAsync(IdentifyRequest request, CancellationToken cancellationToken)
    {
        var validationErrors = ValidateRequest(request);
        if (validationErrors.Count > 0)
        {
            return IdentifyResult.ValidationFailure(validationErrors);
        }

        var normalizedName = UserNameNormalizer.Normalize(request.Name);

        var user = await dbContext.Users
            .Include(x => x.Credential)
            .Include(x => x.AuthAttemptState)
            .SingleOrDefaultAsync(x => x.NormalizedName == normalizedName, cancellationToken);

        if (user is null || user.Credential is null)
        {
            return IdentifyResult.Unauthorized();
        }

        var now = DateTime.UtcNow;
        var attemptState = user.AuthAttemptState;

        if (attemptState is null)
        {
            attemptState = new AuthAttemptStateEntity
            {
                UserId = user.UserId,
                ConsecutiveWrongCount = 0,
            };

            dbContext.AuthAttemptStates.Add(attemptState);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (attemptState.DelayUntilUtc is not null && attemptState.DelayUntilUtc > now)
        {
            var retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((attemptState.DelayUntilUtc.Value - now).TotalSeconds));
            return IdentifyResult.Throttled(retryAfterSeconds);
        }

        var pinMatches = pinHasher.Verify(
            request.Pin,
            user.Credential.PinSalt,
            user.Credential.PinHash,
            user.Credential.IterationCount);

        if (pinMatches)
        {
            attemptState.ConsecutiveWrongCount = 0;
            attemptState.LastSuccessfulAuthUtc = now;
            attemptState.DelayUntilUtc = null;
            await dbContext.SaveChangesAsync(cancellationToken);

            return IdentifyResult.Success(new IdentifySuccessResponse(user.UserId, user.DisplayName, true));
        }

        attemptState.ConsecutiveWrongCount += 1;
        attemptState.LastWrongAttemptUtc = now;

        var delaySeconds = GetDelaySeconds(attemptState.ConsecutiveWrongCount);
        attemptState.DelayUntilUtc = now.AddSeconds(delaySeconds);

        await dbContext.SaveChangesAsync(cancellationToken);

        return IdentifyResult.Unauthorized();
    }

    private List<string> ValidateRequest(IdentifyRequest request)
    {
        var validationErrors = new List<string>();

        var nameError = PinPolicyValidator.ValidateName(request.Name);
        if (nameError is not null)
        {
            validationErrors.Add(nameError);
        }

        validationErrors.AddRange(pinPolicyValidator.Validate(request.Pin));
        return validationErrors;
    }

    private int GetDelaySeconds(int consecutiveWrongCount)
    {
        var steps = _throttleOptions.StepsSeconds is { Length: > 0 }
            ? _throttleOptions.StepsSeconds
            : [1, 2, 3, 5, 8, 15, 30];

        var maxSeconds = Math.Max(1, _throttleOptions.MaxSeconds);
        var index = Math.Min(Math.Max(consecutiveWrongCount - 1, 0), steps.Length - 1);
        return Math.Min(Math.Max(1, steps[index]), maxSeconds);
    }
}

public sealed record IdentifyResult(
    IdentifyResultType ResultType,
    IdentifySuccessResponse? Response,
    ErrorResponse? Error,
    int RetryAfterSeconds = 0)
{
    public static IdentifyResult Success(IdentifySuccessResponse response)
    {
        return new IdentifyResult(IdentifyResultType.Success, response, null);
    }

    public static IdentifyResult ValidationFailure(IReadOnlyList<string> errors)
    {
        return new IdentifyResult(
            IdentifyResultType.ValidationFailed,
            null,
            new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.", errors));
    }

    public static IdentifyResult Unauthorized()
    {
        return new IdentifyResult(
            IdentifyResultType.Unauthorized,
            null,
            new ErrorResponse(UsersErrorCodes.InvalidCredentials, "Invalid name or PIN."));
    }

    public static IdentifyResult Throttled(int retryAfterSeconds)
    {
        return new IdentifyResult(
            IdentifyResultType.Throttled,
            null,
            new ErrorResponse(UsersErrorCodes.Throttled, "Too many attempts. Try again later."),
            retryAfterSeconds);
    }
}

public enum IdentifyResultType
{
    Success = 0,
    ValidationFailed = 1,
    Unauthorized = 2,
    Throttled = 3,
}
