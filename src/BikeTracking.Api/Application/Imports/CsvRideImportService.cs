using System.Text.Json;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;

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
        var csvText = ImportText.Decode(csvBytes);
        var parsedDocument = CsvParser.Parse(csvText);

        var (previewRows, importRows, validRows) = BuildRowData(parsedDocument);

        var duplicateCandidates = BuildDuplicateCandidates(importRows);

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
            "csv",
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

    public Task<ImportStartResponse> StartAsync(
        long riderId,
        ImportStartRequest request,
        CancellationToken cancellationToken
    )
    {
        return ImportJobLifecycle.StartAsync(
            importJobRepository,
            importJobProcessor,
            riderId,
            request,
            cancellationToken
        );
    }

    public Task<ImportStatusResponse?> GetStatusAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return ImportJobLifecycle.GetStatusAsync(
            importJobRepository,
            riderId,
            importJobId,
            cancellationToken
        );
    }

    public Task<ImportCancelResponse?> CancelAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return ImportJobLifecycle.CancelAsync(
            importJobRepository,
            riderId,
            importJobId,
            cancellationToken
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
                CreateImportRowEntity(
                    parsedRow,
                    parsedDate,
                    parsedMiles,
                    parsedRideMinutes,
                    parsedTemp,
                    isValid,
                    errors
                )
            );
        }

        return (previewRows, importRows, validRows);
    }

    private static ImportRowEntity CreateImportRowEntity(
        ParsedCsvRow parsedRow,
        DateOnly parsedDate,
        decimal? parsedMiles,
        int? parsedRideMinutes,
        decimal? parsedTemp,
        bool isValid,
        IReadOnlyList<ImportValidationError> errors
    )
    {
        int? parsedDifficulty = null;
        if (
            parsedRow.Difficulty is not null
            && int.TryParse(parsedRow.Difficulty, out var diffInt)
            && diffInt >= 1
            && diffInt <= 5
        )
        {
            parsedDifficulty = diffInt;
        }

        string? parsedDirection = null;
        if (parsedRow.PrimaryTravelDirection is not null)
        {
            parsedDirection = WindResistance.validDirectionNames.FirstOrDefault(d =>
                string.Equals(
                    d,
                    parsedRow.PrimaryTravelDirection.Trim(),
                    StringComparison.OrdinalIgnoreCase
                )
            );
        }

        return new ImportRowEntity
        {
            RowNumber = parsedRow.RowNumber,
            RideDateLocal = parsedDate,
            Miles = isValid ? parsedMiles : null,
            RideMinutes = parsedRideMinutes,
            Temperature = parsedTemp,
            TagsRaw = parsedRow.Tags,
            Notes = parsedRow.Notes,
            Difficulty = isValid ? parsedDifficulty : null,
            PrimaryTravelDirection = isValid ? parsedDirection : null,
            ValidationStatus = isValid ? "valid" : "invalid",
            ValidationErrorsJson = isValid ? null : JsonSerializer.Serialize(errors),
            DuplicateStatus = "none",
            ProcessingStatus = isValid ? "pending" : "failed",
        };
    }

    private static IReadOnlyList<ImportDuplicateCandidate> BuildDuplicateCandidates(
        IReadOnlyList<ImportRowEntity> importRows
    )
    {
        return importRows
            .Where(row =>
                row.ValidationStatus == "valid" && row.Miles is > 0 && row.RideDateLocal != default
            )
            .Select(row => new ImportDuplicateCandidate(
                row.RowNumber,
                row.RideDateLocal!.Value,
                row.Miles!.Value,
                row.Temperature
            ))
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
}
