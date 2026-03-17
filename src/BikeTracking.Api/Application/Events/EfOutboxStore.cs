using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Events;

public sealed class EfOutboxStore(IServiceScopeFactory scopeFactory) : IOutboxStore
{
    public async Task<IReadOnlyList<OutboxEventEntity>> LoadPendingAsync(
        int maxBatchSize,
        DateTime utcNow,
        CancellationToken cancellationToken
    )
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        return await dbContext
            .OutboxEvents.Where(x => x.PublishedAtUtc == null && x.NextAttemptUtc <= utcNow)
            .OrderBy(x => x.OutboxEventId)
            .Take(maxBatchSize)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public async Task MarkPublishedAsync(
        long outboxEventId,
        DateTime publishedAtUtc,
        CancellationToken cancellationToken
    )
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        var eventEntity = await dbContext.OutboxEvents.SingleAsync(
            x => x.OutboxEventId == outboxEventId,
            cancellationToken
        );

        eventEntity.PublishedAtUtc = publishedAtUtc;
        eventEntity.LastError = null;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ScheduleRetryAsync(
        long outboxEventId,
        int retryCount,
        DateTime nextAttemptUtc,
        string? lastError,
        CancellationToken cancellationToken
    )
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

        var eventEntity = await dbContext.OutboxEvents.SingleAsync(
            x => x.OutboxEventId == outboxEventId,
            cancellationToken
        );

        eventEntity.RetryCount = retryCount;
        eventEntity.NextAttemptUtc = nextAttemptUtc;
        eventEntity.LastError = lastError;
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
