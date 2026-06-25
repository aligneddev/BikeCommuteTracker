using System.Text;
using System.Text.Json;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Imports;

public sealed class MonthlySummaryImportService(
    BikeTrackingDbContext dbContext,
    IImportJobRepository importJobRepository,
    IImportJobProcessor importJobProcessor
) : IMonthlySummaryImportService
{
    private const string ImportSource = "monthly-import";
    private const string ImportType = "monthly-summary";
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    public async Task<MonthlyImportPreviewResponse> PreviewAsync(
        long riderId,
        MonthlyImportPreviewRequest request,
        CancellationToken cancellationToken
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.FileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.ContentBase64);
        ValidateYear(request.StartYear);

        var decodedBytes = Convert.FromBase64String(request.ContentBase64);
        if (decodedBytes.Length > MaxUploadBytes)
        {
            throw new ArgumentException("Monthly summary file must be 5 MB or smaller.");
        }

        var text = DecodeText(decodedBytes);
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Monthly summary content is required.");
        }

        var parsedDocument = MonthlySummaryParser.Parse(text);
        var assignedRows = AssignYears(parsedDocument.Rows, request.StartYear);
        var validationLookup = MonthlySummaryValidationRules.ValidateRows(assignedRows);
        var existingRides = await dbContext
            .Rides.AsNoTracking()
            .Where(ride => ride.RiderId == riderId)
            .Select(ride => new
            {
                ride.Id,
                ride.RideDateTimeLocal,
                ride.Miles,
            })
            .ToListAsync(cancellationToken);

        var rideIndex = 0;
        var monthRows = new List<MonthlyImportMonthRow>();
        var importRows = new List<ImportRowEntity>();
        var totalGeneratedRides = 0;
        var duplicateRideCount = 0;

        foreach (var row in assignedRows)
        {
            validationLookup.TryGetValue(row.RowNumber, out var rowErrors);
            rowErrors ??= Array.Empty<ImportValidationError>();
            var isValid = rowErrors.Count == 0;
            var generatedRides = new List<MonthlyImportGeneratedRide>();

            if (isValid)
            {
                var distribution = MonthlySummaryDistributor.distributeRides(
                    row.Month!.Value,
                    row.Year!.Value,
                    row.Miles!.Value,
                    row.Days!.Value
                );

                if (distribution.IsOk)
                {
                    foreach (var (date, miles) in distribution.ResultValue)
                    {
                        rideIndex++;
                        totalGeneratedRides++;

                        var matches = existingRides
                            .Where(existing =>
                                DateOnly.FromDateTime(existing.RideDateTimeLocal) == date
                            )
                            .Select(existing => new ImportDuplicateMatch(
                                existing.Id,
                                existing.RideDateTimeLocal.ToString("yyyy-MM-dd"),
                                existing.Miles
                            ))
                            .ToArray();

                        if (matches.Length > 0)
                        {
                            duplicateRideCount++;
                        }

                        generatedRides.Add(
                            new MonthlyImportGeneratedRide(
                                RideIndex: rideIndex,
                                Date: date.ToString("yyyy-MM-dd"),
                                Miles: miles,
                                IsDuplicate: matches.Length > 0,
                                DuplicateMatches: matches
                            )
                        );

                        importRows.Add(
                            new ImportRowEntity
                            {
                                RowNumber = rideIndex,
                                RideDateLocal = date,
                                Miles = miles,
                                ValidationStatus = "valid",
                                ValidationErrorsJson = null,
                                DuplicateStatus = matches.Length > 0 ? "duplicate" : "none",
                                DuplicateResolution = null,
                                ProcessingStatus = "pending",
                                ExistingRideIdsJson =
                                    matches.Length > 0
                                        ? JsonSerializer.Serialize(
                                            matches.Select(match => match.ExistingRideId)
                                        )
                                        : null,
                                CreatedRideId = null,
                                ImportSource = ImportSource,
                            }
                        );
                    }
                }
            }

            monthRows.Add(
                new MonthlyImportMonthRow(
                    RowNumber: row.RowNumber,
                    RawMonth: row.MonthName,
                    Year: row.Year,
                    TotalMiles: row.Miles,
                    Days: row.Days,
                    IsValid: isValid,
                    Errors: rowErrors,
                    GeneratedRides: generatedRides
                )
            );
        }

        var totalMonthRows = assignedRows.Count;
        var invalidMonthRows = monthRows.Count(row => !row.IsValid);
        var validMonthRows = totalMonthRows - invalidMonthRows;

        var job = await importJobRepository.CreateJobAsync(
            riderId,
            request.FileName,
            totalGeneratedRides,
            invalidMonthRows,
            ImportType,
            cancellationToken
        );

        await importJobRepository.AddRowsAsync(job.Id, importRows, cancellationToken);

        return new MonthlyImportPreviewResponse(
            ImportJobId: job.Id,
            HeaderDetectionWarning: parsedDocument.HeaderDetectionWarning,
            TotalMonthRows: totalMonthRows,
            ValidMonthRows: validMonthRows,
            InvalidMonthRows: invalidMonthRows,
            TotalGeneratedRides: totalGeneratedRides,
            DuplicateRides: duplicateRideCount,
            RequiresDuplicateResolution: duplicateRideCount > 0,
            MonthRows: monthRows
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

    private static List<MonthlySummaryRow> AssignYears(
        IReadOnlyList<ParsedMonthlySummaryRow> rows,
        int startYear
    )
    {
        var assignedRows = new List<MonthlySummaryRow>(rows.Count);
        var year = startYear;
        int? previousMonth = null;

        foreach (var row in rows)
        {
            MonthlySummaryParser.TryParseMonth(row.RawMonth, out var month, out var monthName);
            MonthlySummaryParser.TryParseMiles(row.RawMiles, out var miles);
            MonthlySummaryParser.TryParseDays(row.RawDays, out var days);

            if (previousMonth.HasValue && month > 0 && month < previousMonth.Value)
            {
                year++;
            }

            assignedRows.Add(
                new MonthlySummaryRow(
                    RowNumber: row.RowNumber,
                    Month: month > 0 ? month : null,
                    MonthName: string.IsNullOrEmpty(monthName)
                        ? row.RawMonth ?? string.Empty
                        : monthName,
                    Miles: miles > 0m ? miles
                        : row.RawMiles is null ? null
                        : miles,
                    Days: days > 0 ? days
                        : row.RawDays is null ? null
                        : days,
                    Year: month > 0 ? year : null
                )
            );

            previousMonth = month > 0 ? month : previousMonth;
        }

        return assignedRows;
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

    private static void ValidateYear(int startYear)
    {
        if (startYear < 2000 || startYear > 2100)
        {
            throw new ArgumentException("Start year must be between 2000 and 2100.");
        }
    }

    private static string DecodeText(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var reader = new StreamReader(
            stream,
            Encoding.UTF8,
            detectEncodingFromByteOrderMarks: true
        );
        return reader.ReadToEnd();
    }
}
