using System.Text.Json;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Contracts;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Application.Events;

public sealed class OutboxPublisherService(
    IOutboxStore outboxStore,
    IUserRegisteredPublisher userRegisteredPublisher,
    IOptions<IdentityOptions> identityOptions,
    ILogger<OutboxPublisherService> logger
) : BackgroundService
{
    private readonly OutboxOptions _outboxOptions = identityOptions.Value.Outbox;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishPendingBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox publisher encountered an unhandled exception.");
            }

            var delay = TimeSpan.FromSeconds(Math.Max(1, _outboxOptions.PollIntervalSeconds));
            await Task.Delay(delay, stoppingToken);
        }
    }

    private async Task PublishPendingBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var batchSize = Math.Max(1, _outboxOptions.MaxBatchSize);
        var pendingEvents = await outboxStore.LoadPendingAsync(batchSize, now, cancellationToken);

        foreach (var outboxEvent in pendingEvents)
        {
            try
            {
                if (
                    !string.Equals(
                        outboxEvent.EventType,
                        UserRegisteredEventPayload.EventTypeName,
                        StringComparison.Ordinal
                    )
                )
                {
                    await outboxStore.MarkPublishedAsync(
                        outboxEvent.OutboxEventId,
                        DateTime.UtcNow,
                        cancellationToken
                    );
                    continue;
                }

                var payload = JsonSerializer.Deserialize<UserRegisteredEventPayload>(
                    outboxEvent.EventPayloadJson
                );
                if (payload is null)
                {
                    throw new InvalidOperationException(
                        $"Unable to deserialize payload for outbox event {outboxEvent.OutboxEventId}."
                    );
                }

                await userRegisteredPublisher.PublishAsync(payload, cancellationToken);
                await outboxStore.MarkPublishedAsync(
                    outboxEvent.OutboxEventId,
                    DateTime.UtcNow,
                    cancellationToken
                );
            }
            catch (Exception ex)
            {
                var retryCount = outboxEvent.RetryCount + 1;
                var delaySeconds = ComputeBackoffSeconds(retryCount);
                var nextAttemptUtc = DateTime.UtcNow.AddSeconds(delaySeconds);

                await outboxStore.ScheduleRetryAsync(
                    outboxEvent.OutboxEventId,
                    retryCount,
                    nextAttemptUtc,
                    ex.Message,
                    cancellationToken
                );

                logger.LogWarning(
                    ex,
                    "Failed to publish outbox event {OutboxEventId}. Retrying at {NextAttemptUtc} (retry #{RetryCount}).",
                    outboxEvent.OutboxEventId,
                    nextAttemptUtc,
                    retryCount
                );
            }
        }
    }

    private int ComputeBackoffSeconds(int retryCount)
    {
        var initial = Math.Max(1, _outboxOptions.InitialBackoffSeconds);
        var max = Math.Max(initial, _outboxOptions.MaxBackoffSeconds);

        var backoff = initial * Math.Pow(2, Math.Max(0, retryCount - 1));
        return (int)Math.Min(backoff, max);
    }
}
