using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Imports;

/// <summary>
/// Start, status, and cancel steps shared by every import type that runs through
/// <see cref="IImportJobRepository"/> and <see cref="IImportJobProcessor"/>.
/// </summary>
public static class ImportJobLifecycle
{
    /// <summary>
    /// Applies duplicate resolutions, marks the job as processing, and hands it to the
    /// background processor.
    /// </summary>
    public static async Task<ImportStartResponse> StartAsync(
        IImportJobRepository importJobRepository,
        IImportJobProcessor importJobProcessor,
        long riderId,
        ImportStartRequest request,
        CancellationToken cancellationToken
    )
    {
        var hasActiveImport = await importJobRepository.HasActiveImportAsync(
            riderId,
            request.ImportJobId,
            cancellationToken
        );

        if (hasActiveImport)
        {
            throw new ImportConflictException("An import is already in progress.");
        }

        var job = await importJobRepository.GetJobAsync(
            riderId,
            request.ImportJobId,
            cancellationToken
        );

        if (job is null)
        {
            throw new InvalidOperationException("Import job was not found.");
        }

        if (job.Status != "awaiting-confirmation")
        {
            throw new ArgumentException("Import job is not ready to start.");
        }

        var jobRows = await importJobRepository.GetJobRowsAsync(job.Id, cancellationToken);

        ResolveDuplicates(job, jobRows, request);

        job.OverrideAllDuplicates = request.OverrideAllDuplicates;
        job.Status = "processing";
        job.StartedAtUtc = DateTime.UtcNow;
        job.EtaMinutesRounded = ImportProgressEstimator.CalculateEtaMinutesRounded(
            job.TotalRows,
            job.ProcessedRows,
            job.StartedAtUtc,
            DateTime.UtcNow
        );

        await importJobRepository.SaveChangesAsync(cancellationToken);

        importJobProcessor.Enqueue(riderId, job.Id);

        return new ImportStartResponse(job.Id, job.Status, job.StartedAtUtc.Value);
    }

    public static async Task<ImportStatusResponse?> GetStatusAsync(
        IImportJobRepository importJobRepository,
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        var job = await importJobRepository.GetJobReadOnlyAsync(
            riderId,
            importJobId,
            cancellationToken
        );

        if (job is null)
        {
            return null;
        }

        var percentComplete = ImportProgressEstimator.CalculatePercentComplete(
            job.TotalRows,
            job.ProcessedRows
        );
        var etaMinutesRounded =
            job.EtaMinutesRounded
            ?? ImportProgressEstimator.CalculateEtaMinutesRounded(
                job.TotalRows,
                job.ProcessedRows,
                job.StartedAtUtc,
                DateTime.UtcNow
            );

        return new ImportStatusResponse(
            ImportJobId: job.Id,
            Status: job.Status,
            TotalRows: job.TotalRows,
            ProcessedRows: job.ProcessedRows,
            ImportedRows: job.ImportedRows,
            SkippedRows: job.SkippedRows,
            FailedRows: job.FailedRows,
            PercentComplete: percentComplete,
            EtaMinutesRounded: etaMinutesRounded,
            CreatedAtUtc: job.CreatedAtUtc,
            StartedAtUtc: job.StartedAtUtc,
            CompletedAtUtc: job.CompletedAtUtc,
            LastError: job.LastError
        );
    }

    public static async Task<ImportCancelResponse?> CancelAsync(
        IImportJobRepository importJobRepository,
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        var job = await importJobRepository.GetJobAsync(riderId, importJobId, cancellationToken);

        if (job is null)
        {
            return null;
        }

        if (job.Status is not "completed" and not "failed" and not "cancelled")
        {
            job.Status = "cancelled";
            job.CompletedAtUtc = DateTime.UtcNow;
            job.EtaMinutesRounded = null;
            await importJobRepository.SaveChangesAsync(cancellationToken);
        }

        return new ImportCancelResponse(
            ImportJobId: job.Id,
            Status: job.Status,
            ProcessedRows: job.ProcessedRows,
            ImportedRows: job.ImportedRows,
            SkippedRows: job.SkippedRows,
            FailedRows: job.FailedRows,
            CancelledAtUtc: job.CompletedAtUtc ?? DateTime.UtcNow
        );
    }

    private static void ResolveDuplicates(
        ImportJobEntity job,
        IReadOnlyList<ImportRowEntity> jobRows,
        ImportStartRequest request
    )
    {
        var resolutionLookup = (request.Resolutions ?? []).ToDictionary(
            static x => x.RowNumber,
            static x => x.Action,
            EqualityComparer<int>.Default
        );

        foreach (var row in jobRows.Where(x => x.DuplicateStatus == "duplicate"))
        {
            if (request.OverrideAllDuplicates)
            {
                row.DuplicateResolution = "override-all";
                row.DuplicateStatus = "resolved";
                continue;
            }

            if (!resolutionLookup.TryGetValue(row.RowNumber, out var action))
            {
                throw new ArgumentException(
                    $"Duplicate row {row.RowNumber} requires a resolution or override-all."
                );
            }

            if (action is not ("keep-existing" or "replace-with-import"))
            {
                throw new ArgumentException(
                    $"Duplicate row {row.RowNumber} has an invalid resolution action."
                );
            }

            row.DuplicateResolution = action;
            row.DuplicateStatus = "resolved";

            if (action == "keep-existing")
            {
                row.ProcessingStatus = "skipped";
                job.SkippedRows += 1;
                job.ProcessedRows += 1;
            }
        }
    }
}
