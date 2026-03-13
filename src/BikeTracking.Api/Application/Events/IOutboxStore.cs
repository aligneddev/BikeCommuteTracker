using BikeTracking.Api.Infrastructure.Persistence;

namespace BikeTracking.Api.Application.Events;

public interface IOutboxStore
{
    Task<IReadOnlyList<OutboxEventEntity>> LoadPendingAsync(int maxBatchSize, DateTime utcNow, CancellationToken cancellationToken);
    Task MarkPublishedAsync(long outboxEventId, DateTime publishedAtUtc, CancellationToken cancellationToken);
    Task ScheduleRetryAsync(long outboxEventId, int retryCount, DateTime nextAttemptUtc, string? lastError, CancellationToken cancellationToken);
}
