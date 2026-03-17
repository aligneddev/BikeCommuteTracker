using System.Text.Json;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Users;

public sealed class SignupService(
    BikeTrackingDbContext dbContext,
    PinPolicyValidator pinPolicyValidator,
    IPinHasher pinHasher,
    ILogger<SignupService> logger
)
{
    public async Task<SignupResult> SignupAsync(
        SignupRequest request,
        CancellationToken cancellationToken
    )
    {
        var validationErrors = ValidateRequest(request);
        if (validationErrors.Count > 0)
        {
            return SignupResult.ValidationFailure(validationErrors);
        }

        var displayName = UserNameNormalizer.CanonicalDisplayName(request.Name);
        var normalizedName = UserNameNormalizer.Normalize(request.Name);

        if (
            await dbContext.Users.AnyAsync(
                x => x.NormalizedName == normalizedName,
                cancellationToken
            )
        )
        {
            return SignupResult.DuplicateName();
        }

        var hashResult = pinHasher.Hash(request.Pin);
        var utcNow = DateTime.UtcNow;

        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            cancellationToken
        );

        try
        {
            var user = new UserEntity
            {
                DisplayName = displayName,
                NormalizedName = normalizedName,
                CreatedAtUtc = utcNow,
                IsActive = true,
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            dbContext.UserCredentials.Add(
                new UserCredentialEntity
                {
                    UserId = user.UserId,
                    PinHash = hashResult.Hash,
                    PinSalt = hashResult.Salt,
                    HashAlgorithm = hashResult.Algorithm,
                    IterationCount = hashResult.Iterations,
                    CredentialVersion = hashResult.CredentialVersion,
                    UpdatedAtUtc = utcNow,
                }
            );

            dbContext.AuthAttemptStates.Add(
                new AuthAttemptStateEntity
                {
                    UserId = user.UserId,
                    ConsecutiveWrongCount = 0,
                    LastWrongAttemptUtc = null,
                    DelayUntilUtc = null,
                    LastSuccessfulAuthUtc = null,
                }
            );

            var eventPayload = UserRegisteredEventPayload.Create(
                user.UserId,
                user.DisplayName,
                utcNow
            );
            dbContext.OutboxEvents.Add(
                new OutboxEventEntity
                {
                    AggregateType = "User",
                    AggregateId = user.UserId,
                    EventType = UserRegisteredEventPayload.EventTypeName,
                    EventPayloadJson = JsonSerializer.Serialize(eventPayload),
                    OccurredAtUtc = utcNow,
                    RetryCount = 0,
                    NextAttemptUtc = utcNow,
                    PublishedAtUtc = null,
                    LastError = null,
                }
            );

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var response = new SignupSuccessResponse(
                user.UserId,
                user.DisplayName,
                user.CreatedAtUtc,
                "queued"
            );

            return SignupResult.Success(response);
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(
                ex,
                "Signup persistence failed for normalized user name {NormalizedName}.",
                normalizedName
            );
            await transaction.RollbackAsync(cancellationToken);

            if (
                await dbContext.Users.AnyAsync(
                    x => x.NormalizedName == normalizedName,
                    cancellationToken
                )
            )
            {
                return SignupResult.DuplicateName();
            }

            return SignupResult.ValidationFailure(["Unable to create user profile."]);
        }
    }

    private List<string> ValidateRequest(SignupRequest request)
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
}

public sealed record SignupResult(
    bool IsSuccess,
    bool IsDuplicateName,
    SignupSuccessResponse? Response,
    ErrorResponse? Error
)
{
    public static SignupResult Success(SignupSuccessResponse response)
    {
        return new SignupResult(true, false, response, null);
    }

    public static SignupResult DuplicateName()
    {
        return new SignupResult(
            false,
            true,
            null,
            new ErrorResponse(UsersErrorCodes.NameAlreadyExists, "name already exists")
        );
    }

    public static SignupResult ValidationFailure(IReadOnlyList<string> errors)
    {
        return new SignupResult(
            false,
            false,
            null,
            new ErrorResponse(UsersErrorCodes.ValidationFailed, "Validation failed.", errors)
        );
    }
}
