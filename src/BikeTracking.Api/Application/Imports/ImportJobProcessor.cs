using BikeTracking.Api.Application.Notifications;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Imports;

public interface IImportJobProcessor
{
    void Enqueue(long riderId, long importJobId);
}

public sealed class ImportJobProcessor(IServiceScopeFactory serviceScopeFactory)
    : IImportJobProcessor
{
    public void Enqueue(long riderId, long importJobId)
    {
        _ = Task.Run(
            async () => await ProcessAsync(riderId, importJobId, CancellationToken.None),
            CancellationToken.None
        );
    }

    private async Task ProcessAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            await using var scope = serviceScopeFactory.CreateAsyncScope();
            var repository = scope.ServiceProvider.GetRequiredService<IImportJobRepository>();
            var notifier = scope.ServiceProvider.GetRequiredService<IImportProgressNotifier>();

            var job = await repository.GetJobAsync(riderId, importJobId, cancellationToken);
            if (job is null || job.Status != "processing")
            {
                return;
            }

            var rowsToProcess = await repository.GetPendingRowsAsync(
                importJobId,
                cancellationToken
            );

            var sentMilestones = ImportProgressEstimator
                .GetReachedMilestones(job.TotalRows, job.ProcessedRows)
                .ToHashSet();

            // Delay the first unit of processing so Start can return a stable processing state.
            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);

            foreach (var row in rowsToProcess)
            {
                await repository.ReloadJobAsync(job, cancellationToken);
                if (job.Status == "cancelled")
                {
                    break;
                }

                await Task.Delay(TimeSpan.FromMilliseconds(75), cancellationToken);

                row.ProcessingStatus = "imported";
                job.ImportedRows += 1;
                job.ProcessedRows += 1;
                job.EtaMinutesRounded = ImportProgressEstimator.CalculateEtaMinutesRounded(
                    job.TotalRows,
                    job.ProcessedRows,
                    job.StartedAtUtc,
                    DateTime.UtcNow
                );

                await repository.SaveChangesAsync(cancellationToken);

                await EmitMilestoneNotificationsAsync(
                    job,
                    riderId,
                    sentMilestones,
                    notifier,
                    cancellationToken
                );
            }

            await repository.ReloadJobAsync(job, cancellationToken);
            if (job.Status != "cancelled")
            {
                job.Status = "completed";
                job.CompletedAtUtc = DateTime.UtcNow;
                job.EtaMinutesRounded = 0;
                await repository.SaveChangesAsync(cancellationToken);
            }

            await notifier.NotifyProgressAsync(
                CreateProgressNotification(job, riderId),
                cancellationToken
            );
        }
        catch
        {
            await MarkAsFailedAsync(riderId, importJobId, cancellationToken);
        }
    }

    private async Task MarkAsFailedAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        await using var scope = serviceScopeFactory.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IImportJobRepository>();
        var notifier = scope.ServiceProvider.GetRequiredService<IImportProgressNotifier>();

        var job = await repository.GetJobAsync(riderId, importJobId, cancellationToken);
        if (job is null || job.Status == "cancelled")
        {
            return;
        }

        job.Status = "failed";
        job.LastError = "Import processing failed.";
        job.CompletedAtUtc = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);

        await notifier.NotifyProgressAsync(
            CreateProgressNotification(job, riderId),
            cancellationToken
        );
    }

    private static async Task EmitMilestoneNotificationsAsync(
        ImportJobEntity job,
        long riderId,
        HashSet<int> sentMilestones,
        IImportProgressNotifier notifier,
        CancellationToken cancellationToken
    )
    {
        var milestones = ImportProgressEstimator.GetReachedMilestones(
            job.TotalRows,
            job.ProcessedRows
        );
        foreach (var milestone in milestones)
        {
            if (!sentMilestones.Add(milestone))
            {
                continue;
            }

            await notifier.NotifyProgressAsync(
                CreateProgressNotification(job, riderId),
                cancellationToken
            );
        }
    }

    internal static ImportProgressNotification CreateProgressNotification(
        ImportJobEntity job,
        long riderId
    )
    {
        return new ImportProgressNotification(
            RiderId: riderId,
            ImportJobId: job.Id,
            Status: job.Status,
            PercentComplete: ImportProgressEstimator.CalculatePercentComplete(
                job.TotalRows,
                job.ProcessedRows
            ),
            EtaMinutesRounded: job.EtaMinutesRounded,
            ProcessedRows: job.ProcessedRows,
            TotalRows: job.TotalRows,
            ImportedRows: job.ImportedRows,
            SkippedRows: job.SkippedRows,
            FailedRows: job.FailedRows,
            EmittedAtUtc: DateTime.UtcNow
        );
    }
}
