using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application.Users;

public sealed class IdentifyServiceTests
{
    [Fact]
    public async Task IdentifyAsync_ReturnsValidationFailure_WhenRequestIsInvalid()
    {
        var (_, service, _) = CreateService(pin => pin == "1234");

        var result = await service.IdentifyAsync(
            new IdentifyRequest("", "12ab"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.ValidationFailed, result.ResultType);
        Assert.NotNull(result.Error);
        Assert.Contains("Name is required.", result.Error.Details ?? []);
        Assert.Contains("PIN must contain only numeric characters.", result.Error.Details ?? []);
    }

    [Fact]
    public async Task IdentifyAsync_ReturnsUnauthorized_WhenUserNotFound()
    {
        var (_, service, _) = CreateService(pin => pin == "1234");

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Unknown", "1234"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Unauthorized, result.ResultType);
    }

    [Fact]
    public async Task IdentifyAsync_ReturnsUnauthorizedAndIncrementsAttemptState_WhenPinIsWrong()
    {
        var (dbContext, service, _) = CreateService(pin => pin == "1234");
        var user = await SeedUserAsync(dbContext);

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Alice", "0000"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Unauthorized, result.ResultType);

        var updatedState = await dbContext.AuthAttemptStates.SingleAsync(x =>
            x.UserId == user.UserId
        );
        Assert.Equal(1, updatedState.ConsecutiveWrongCount);
        Assert.NotNull(updatedState.LastWrongAttemptUtc);
        Assert.NotNull(updatedState.DelayUntilUtc);
    }

    [Fact]
    public async Task IdentifyAsync_ReturnsSuccessAndResetsAttemptState_WhenPinMatches()
    {
        var (dbContext, service, _) = CreateService(pin => pin == "1234");
        var user = await SeedUserAsync(
            dbContext,
            new AuthAttemptStateEntity
            {
                ConsecutiveWrongCount = 3,
                DelayUntilUtc = DateTime.UtcNow.AddSeconds(-1),
                LastWrongAttemptUtc = DateTime.UtcNow.AddSeconds(-2),
            }
        );

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Alice", "1234"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Success, result.ResultType);
        Assert.NotNull(result.Response);
        Assert.Equal(user.UserId, result.Response.UserId);
        Assert.Equal("Alice", result.Response.UserName);
        Assert.True(result.Response.Authorized);

        var updatedState = await dbContext.AuthAttemptStates.SingleAsync(x =>
            x.UserId == user.UserId
        );
        Assert.Equal(0, updatedState.ConsecutiveWrongCount);
        Assert.Null(updatedState.DelayUntilUtc);
        Assert.NotNull(updatedState.LastSuccessfulAuthUtc);
    }

    [Fact]
    public async Task IdentifyAsync_CreatesAttemptState_WhenMissing()
    {
        var (dbContext, service, _) = CreateService(pin => pin == "1234");
        var user = await SeedUserAsync(dbContext, attemptState: null);

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Alice", "0000"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Unauthorized, result.ResultType);

        var state = await dbContext.AuthAttemptStates.SingleAsync(x => x.UserId == user.UserId);
        Assert.Equal(1, state.ConsecutiveWrongCount);
    }

    [Fact]
    public async Task IdentifyAsync_ReturnsThrottled_WhenDelayWindowIsActive()
    {
        var (dbContext, service, pinHasher) = CreateService(pin => pin == "1234");

        await SeedUserAsync(
            dbContext,
            new AuthAttemptStateEntity
            {
                ConsecutiveWrongCount = 2,
                DelayUntilUtc = DateTime.UtcNow.AddSeconds(5),
                LastWrongAttemptUtc = DateTime.UtcNow,
            }
        );

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Alice", "1234"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Throttled, result.ResultType);
        Assert.InRange(result.RetryAfterSeconds, 1, 5);
        Assert.Equal(0, pinHasher.VerifyCallCount);
    }

    [Fact]
    public async Task IdentifyAsync_UsesProgressiveDelaySteps_ForWrongAttempts()
    {
        var (dbContext, service, _) = CreateService(pin => pin == "1234");
        var user = await SeedUserAsync(
            dbContext,
            new AuthAttemptStateEntity { ConsecutiveWrongCount = 0 }
        );

        var expectedSteps = new[] { 1, 2, 3, 5, 8, 15, 30 };

        foreach (var expectedDelaySeconds in expectedSteps)
        {
            var result = await service.IdentifyAsync(
                new IdentifyRequest("Alice", "0000"),
                CancellationToken.None
            );

            Assert.Equal(IdentifyResultType.Unauthorized, result.ResultType);

            var state = await dbContext.AuthAttemptStates.SingleAsync(x => x.UserId == user.UserId);
            Assert.NotNull(state.DelayUntilUtc);
            Assert.NotNull(state.LastWrongAttemptUtc);

            var delaySeconds = (int)
                Math.Round(
                    (state.DelayUntilUtc!.Value - state.LastWrongAttemptUtc!.Value).TotalSeconds
                );
            Assert.Equal(expectedDelaySeconds, delaySeconds);

            state.DelayUntilUtc = DateTime.UtcNow.AddSeconds(-1);
            await dbContext.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task IdentifyAsync_RespectsConfiguredMaxThrottleSeconds()
    {
        var (dbContext, service, _) = CreateService(
            pin => pin == "1234",
            options =>
            {
                options.Throttle.StepsSeconds = [10];
                options.Throttle.MaxSeconds = 4;
            }
        );

        var user = await SeedUserAsync(
            dbContext,
            new AuthAttemptStateEntity { ConsecutiveWrongCount = 0 }
        );

        var result = await service.IdentifyAsync(
            new IdentifyRequest("Alice", "0000"),
            CancellationToken.None
        );

        Assert.Equal(IdentifyResultType.Unauthorized, result.ResultType);

        var state = await dbContext.AuthAttemptStates.SingleAsync(x => x.UserId == user.UserId);
        var delaySeconds = (int)
            Math.Round(
                (state.DelayUntilUtc!.Value - state.LastWrongAttemptUtc!.Value).TotalSeconds
            );

        Assert.Equal(4, delaySeconds);
    }

    private static (BikeTrackingDbContext, IdentifyService, DelegatePinHasher) CreateService(
        Func<string, bool> verifyPin,
        Action<IdentityOptions>? configureOptions = null
    )
    {
        var options = TestFactories.IdentityOptions(configureOptions);
        var dbContext = TestFactories.CreateDbContext();
        var validator = new PinPolicyValidator(options);
        var pinHasher = new DelegatePinHasher(verifyPin);
        var service = new IdentifyService(dbContext, validator, pinHasher, options);

        return (dbContext, service, pinHasher);
    }

    private static async Task<UserEntity> SeedUserAsync(
        BikeTrackingDbContext dbContext,
        AuthAttemptStateEntity? attemptState = null
    )
    {
        var user = new UserEntity
        {
            DisplayName = "Alice",
            NormalizedName = "ALICE",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true,
            Credential = new UserCredentialEntity
            {
                PinHash = [1, 2, 3, 4],
                PinSalt = [5, 6, 7, 8],
                HashAlgorithm = "PBKDF2-SHA256",
                IterationCount = 10000,
                CredentialVersion = 1,
                UpdatedAtUtc = DateTime.UtcNow,
            },
            AuthAttemptState = attemptState,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return user;
    }
}
