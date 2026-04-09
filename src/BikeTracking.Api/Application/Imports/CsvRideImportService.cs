using System.Text;
using System.Text.Json;
using BikeTracking.Api.Application.Notifications;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Imports;

public sealed class CsvRideImportService(
    BikeTrackingDbContext dbContext,
    IDuplicateResolutionService duplicateResolutionService,
    IServiceScopeFactory serviceScopeFactory
) : ICsvRideImportService
{
    public async Task<ImportPreviewResponse> PreviewAsync(
        long riderId,
        ImportPreviewRequest request,
        CancellationToken cancellationToken
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.FileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.ContentBase64);

        var csvBytes = Convert.FromBase64String(request.ContentBase64);
        var csvText = Encoding.UTF8.GetString(csvBytes);
        var parsedDocument = CsvParser.Parse(csvText);

        var previewRows = new List<ImportPreviewRow>();
        var importRows = new List<ImportRowEntity>();
        var validRows = 0;
        var duplicateCandidates = new List<ImportDuplicateCandidate>();

        foreach (var parsedRow in parsedDocument.Rows)
        {
            var errors = CsvValidationRules.ValidateRow(parsedRow);
            var isValid = errors.Count == 0;
            if (isValid)
            {
                validRows += 1;
            }

            CsvValidationRules.TryParseDate(parsedRow.Date, out var parsedDate);
            CsvValidationRules.TryParseMiles(parsedRow.Miles, out var parsedMiles);
            CsvValidationRules.TryParseRideMinutes(parsedRow.Time, out var parsedRideMinutes);
            CsvValidationRules.TryParseTemperature(parsedRow.Temp, out var parsedTemp);

            if (isValid && parsedDate != default && parsedMiles > 0)
            {
                duplicateCandidates.Add(
                    new ImportDuplicateCandidate(parsedRow.RowNumber, parsedDate, parsedMiles)
                );
            }

            previewRows.Add(
                new ImportPreviewRow(
                    RowNumber: parsedRow.RowNumber,
                    Date: parsedRow.Date,
                    Miles: parsedMiles,
                    RideMinutes: parsedRideMinutes,
                    Temperature: parsedTemp,
                    Tags: parsedRow.Tags,
                    Notes: parsedRow.Notes,
                    IsValid: isValid,
                    Errors: errors,
                    DuplicateMatches: []
                )
            );

            importRows.Add(
                new ImportRowEntity
                {
                    RowNumber = parsedRow.RowNumber,
                    RideDateLocal = CsvValidationRules.TryParseDate(parsedRow.Date, out var rowDate)
                        ? rowDate
                        : null,
                    Miles = CsvValidationRules.TryParseMiles(parsedRow.Miles, out var rowMiles)
                        ? rowMiles
                        : null,
                    RideMinutes = parsedRideMinutes,
                    Temperature = parsedTemp,
                    TagsRaw = parsedRow.Tags,
                    Notes = parsedRow.Notes,
                    ValidationStatus = isValid ? "valid" : "invalid",
                    ValidationErrorsJson = isValid ? null : JsonSerializer.Serialize(errors),
                    DuplicateStatus = "none",
                    ProcessingStatus = isValid ? "pending" : "failed",
                }
            );
        }

        var duplicateLookup = await duplicateResolutionService.GetDuplicateMatchesAsync(
            riderId,
            duplicateCandidates,
            cancellationToken
        );

        var duplicateRows = 0;
        for (var index = 0; index < previewRows.Count; index++)
        {
            var row = previewRows[index];
            if (!duplicateLookup.TryGetValue(row.RowNumber, out var matches))
            {
                continue;
            }

            duplicateRows += 1;
            previewRows[index] = row with { DuplicateMatches = matches };
        }

        foreach (var entity in importRows)
        {
            if (!duplicateLookup.TryGetValue(entity.RowNumber, out var matches))
            {
                continue;
            }

            entity.DuplicateStatus = "duplicate";
            entity.ExistingRideIdsJson = JsonSerializer.Serialize(
                matches.Select(static x => x.ExistingRideId)
            );
        }

        var totalRows = parsedDocument.Rows.Count;
        var invalidRows = totalRows - validRows;

        var job = new ImportJobEntity
        {
            RiderId = riderId,
            FileName = request.FileName,
            Status = "awaiting-confirmation",
            TotalRows = totalRows,
            ProcessedRows = 0,
            ImportedRows = 0,
            SkippedRows = 0,
            FailedRows = invalidRows,
            CreatedAtUtc = DateTime.UtcNow,
        };

        dbContext.ImportJobs.Add(job);
        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var row in importRows)
        {
            row.ImportJobId = job.Id;
        }

        dbContext.ImportRows.AddRange(importRows);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ImportPreviewResponse(
            ImportJobId: job.Id,
            TotalRows: totalRows,
            ValidRows: validRows,
            InvalidRows: invalidRows,
            DuplicateRows: duplicateRows,
            RequiresDuplicateResolution: duplicateRows > 0,
            Rows: previewRows
        );
    }

    public async Task<ImportStartResponse> StartAsync(
        long riderId,
        ImportStartRequest request,
        CancellationToken cancellationToken
    )
    {
        var hasActiveImport = await dbContext.ImportJobs.AnyAsync(
            x => x.RiderId == riderId && x.Status == "processing" && x.Id != request.ImportJobId,
            cancellationToken
        );

        if (hasActiveImport)
        {
            throw new ImportConflictException("An import is already in progress.");
        }

        var job = await dbContext.ImportJobs.SingleOrDefaultAsync(
            x => x.Id == request.ImportJobId && x.RiderId == riderId,
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

        var jobRows = await dbContext
            .ImportRows.Where(x => x.ImportJobId == job.Id)
            .OrderBy(x => x.RowNumber)
            .ToListAsync(cancellationToken);

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

        job.OverrideAllDuplicates = request.OverrideAllDuplicates;
        job.Status = "processing";
        job.StartedAtUtc = DateTime.UtcNow;
        job.EtaMinutesRounded = ImportProgressEstimator.CalculateEtaMinutesRounded(
            job.TotalRows,
            job.ProcessedRows,
            job.StartedAtUtc,
            DateTime.UtcNow
        );

        await dbContext.SaveChangesAsync(cancellationToken);

        _ = Task.Run(
            async () => await ProcessImportJobAsync(riderId, job.Id, CancellationToken.None),
            CancellationToken.None
        );

        return new ImportStartResponse(job.Id, job.Status, job.StartedAtUtc.Value);
    }

    private async Task ProcessImportJobAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            await using var scope = serviceScopeFactory.CreateAsyncScope();
            var scopedDbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
            var scopedNotifier =
                scope.ServiceProvider.GetRequiredService<IImportProgressNotifier>();

            var job = await scopedDbContext.ImportJobs.SingleOrDefaultAsync(
                x => x.Id == importJobId && x.RiderId == riderId,
                cancellationToken
            );
            if (job is null || job.Status != "processing")
            {
                return;
            }

            var rowsToProcess = await scopedDbContext
                .ImportRows.Where(x =>
                    x.ImportJobId == importJobId && x.ProcessingStatus == "pending"
                )
                .OrderBy(x => x.RowNumber)
                .ToListAsync(cancellationToken);

            var sentMilestones = ImportProgressEstimator
                .GetReachedMilestones(job.TotalRows, job.ProcessedRows)
                .ToHashSet();

            // Delay the first unit of processing so Start can return a stable processing state.
            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);

            foreach (var row in rowsToProcess)
            {
                await scopedDbContext.Entry(job).ReloadAsync(cancellationToken);
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

                await scopedDbContext.SaveChangesAsync(cancellationToken);

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

                    await scopedNotifier.NotifyProgressAsync(
                        CreateProgressNotification(job, riderId),
                        cancellationToken
                    );
                }
            }

            await scopedDbContext.Entry(job).ReloadAsync(cancellationToken);
            if (job.Status != "cancelled")
            {
                job.Status = "completed";
                job.CompletedAtUtc = DateTime.UtcNow;
                job.EtaMinutesRounded = 0;
                await scopedDbContext.SaveChangesAsync(cancellationToken);
            }

            await scopedNotifier.NotifyProgressAsync(
                CreateProgressNotification(job, riderId),
                cancellationToken
            );
        }
        catch
        {
            await MarkImportAsFailedAsync(riderId, importJobId, cancellationToken);
        }
    }

    private async Task MarkImportAsFailedAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        await using var scope = serviceScopeFactory.CreateAsyncScope();
        var scopedDbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var scopedNotifier = scope.ServiceProvider.GetRequiredService<IImportProgressNotifier>();

        var job = await scopedDbContext.ImportJobs.SingleOrDefaultAsync(
            x => x.Id == importJobId && x.RiderId == riderId,
            cancellationToken
        );
        if (job is null || job.Status == "cancelled")
        {
            return;
        }

        job.Status = "failed";
        job.LastError = "Import processing failed.";
        job.CompletedAtUtc = DateTime.UtcNow;
        await scopedDbContext.SaveChangesAsync(cancellationToken);

        await scopedNotifier.NotifyProgressAsync(
            CreateProgressNotification(job, riderId),
            cancellationToken
        );
    }

    private static ImportProgressNotification CreateProgressNotification(
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

    public async Task<ImportStatusResponse?> GetStatusAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext
            .ImportJobs.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == importJobId && x.RiderId == riderId,
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

    public async Task<ImportCancelResponse?> CancelAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ImportJobs.SingleOrDefaultAsync(
            x => x.Id == importJobId && x.RiderId == riderId,
            cancellationToken
        );

        if (job is null)
        {
            return null;
        }

        if (job.Status is not "completed" and not "failed" and not "cancelled")
        {
            job.Status = "cancelled";
            job.CompletedAtUtc = DateTime.UtcNow;
            job.EtaMinutesRounded = null;
            await dbContext.SaveChangesAsync(cancellationToken);
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
}
