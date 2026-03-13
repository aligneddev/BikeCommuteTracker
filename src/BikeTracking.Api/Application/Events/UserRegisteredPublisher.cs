using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Application.Events;

public interface IUserRegisteredPublisher
{
    Task PublishAsync(UserRegisteredEventPayload payload, CancellationToken cancellationToken);
}

public sealed class UserRegisteredPublisher : IUserRegisteredPublisher
{
    private readonly ILogger<UserRegisteredPublisher> _logger;
    private int _remainingForcedFailures;

    public UserRegisteredPublisher(IOptions<IdentityOptions> options, ILogger<UserRegisteredPublisher> logger)
    {
        _logger = logger;
        _remainingForcedFailures = Math.Max(0, options.Value.Outbox.FailFirstPublishAttempts);
    }

    public Task PublishAsync(UserRegisteredEventPayload payload, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (_remainingForcedFailures > 0)
        {
            Interlocked.Decrement(ref _remainingForcedFailures);
            throw new InvalidOperationException("Simulated publish failure for resilience verification.");
        }

        _logger.LogInformation(
            "Published UserRegistered event. EventId: {EventId}, UserId: {UserId}, UserName: {UserName}",
            payload.EventId,
            payload.UserId,
            payload.UserName);

        return Task.CompletedTask;
    }
}
