using System.Collections.Concurrent;

namespace BikeTracking.Api.Application.Rides;

public sealed class GasPriceRefreshCoordinator
{
    private readonly ConcurrentDictionary<(DateOnly WeekStart, string Grade), LockEntry> _locks = new();

    public async Task<T> RunExclusiveAsync<T>(
        (DateOnly weekStart, string grade) key,
        Func<Task<T>> refresh
    )
    {
        ArgumentNullException.ThrowIfNull(refresh);

        var lockKey = (
            key.weekStart,
            key.grade.Trim().ToUpperInvariant()
        );

        var entry = _locks.AddOrUpdate(
            lockKey,
            static _ => new LockEntry(),
            static (_, existing) =>
            {
                existing.IncrementRefCount();
                return existing;
            }
        );

        await entry.Semaphore.WaitAsync();
        try
        {
            return await refresh();
        }
        finally
        {
            entry.Semaphore.Release();
            if (entry.DecrementRefCount() == 0 && _locks.TryRemove(lockKey, out var removed))
            {
                removed.Semaphore.Dispose();
            }
        }
    }

    private sealed class LockEntry
    {
        private int _refCount = 1;

        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public void IncrementRefCount()
        {
            Interlocked.Increment(ref _refCount);
        }

        public int DecrementRefCount()
        {
            return Interlocked.Decrement(ref _refCount);
        }
    }
}
