using System.Text;
using System.Text.Json;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Imports;

public sealed class CsvRideImportService(
    IImportJobRepository importJobRepository,
    IDuplicateResolutionService duplicateResolutionService,
    IImportJobProcessor importJobProcessor
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

        var (previewRows, importRows, validRows) = BuildRowData(parsedDocument);

        var duplicateCandidates = BuildDuplicateCandidates(previewRows);

        var duplicateLookup = await duplicateResolutionService.GetDuplicateMatchesAsync(
            riderId,
            duplicateCandidates,
            cancellationToken
        );

        var duplicateRows = ApplyDuplicateMatches(previewRows, importRows, duplicateLookup);

        var totalRows = parsedDocument.Rows.Count;
        var invalidRows = totalRows - validRows;

        var job = await importJobRepository.CreateJobAsync(
            riderId,
            request.FileName,
            totalRows,
            invalidRows,
            cancellationToken
        );

        await importJobRepository.AddRowsAsync(job.Id, importRows, cancellationToken);

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

    public async Task<ImportStatusResponse?> GetStatusAsync(
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

    public async Task<ImportCancelResponse?> CancelAsync(
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

    private static (
        List<ImportPreviewRow> PreviewRows,
        List<ImportRowEntity> ImportRows,
        int ValidRows
    ) BuildRowData(ParsedCsvDocument parsedDocument)
    {
        var previewRows = new List<ImportPreviewRow>();
        var importRows = new List<ImportRowEntity>();
        var validRows = 0;

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

        return (previewRows, importRows, validRows);
    }

    private static IReadOnlyList<ImportDuplicateCandidate> BuildDuplicateCandidates(
        List<ImportPreviewRow> previewRows
    )
    {
        return previewRows
            .Where(row => row.IsValid && row.Miles is > 0)
            .Where(row =>
                CsvValidationRules.TryParseDate(row.Date, out var date) && date != default
            )
            .Select(row =>
            {
                CsvValidationRules.TryParseDate(row.Date, out var date);
                return new ImportDuplicateCandidate(row.RowNumber, date, row.Miles!.Value);
            })
            .ToArray();
    }

    private static int ApplyDuplicateMatches(
        List<ImportPreviewRow> previewRows,
        List<ImportRowEntity> importRows,
        IReadOnlyDictionary<int, IReadOnlyList<ImportDuplicateMatch>> duplicateLookup
    )
    {
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

        return duplicateRows;
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
