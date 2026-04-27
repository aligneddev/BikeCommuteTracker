using BikeTracking.Api.Application.Notifications;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Imports;

public interface IImportJobProcessor
{
    void Enqueue(long riderId, long importJobId);
}

public sealed class ImportJobProcessor(IServiceScopeFactory serviceScopeFactory)
    : IImportJobProcessor
{
    private const int MaxExternalCallsPerSecond = 4;
    private const int MaxLookupAttempts = 2;
    private static readonly TimeSpan ThrottleWindow = TimeSpan.FromSeconds(1);

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
            var gasLookupService = scope.ServiceProvider.GetService<IGasPriceLookupService>();
            var weatherLookupService = scope.ServiceProvider.GetService<IWeatherLookupService>();
            var recordRideService = scope.ServiceProvider.GetService<RecordRideService>();
            var dbContext = scope.ServiceProvider.GetService<BikeTrackingDbContext>();

            var job = await repository.GetJobAsync(riderId, importJobId, cancellationToken);
            if (job is null || job.Status != "processing")
            {
                return;
            }

            var rowsToProcess = await repository.GetPendingRowsAsync(
                importJobId,
                cancellationToken
            );

            var enrichment = await PrefetchEnrichmentAsync(
                riderId,
                rowsToProcess,
                dbContext,
                gasLookupService,
                weatherLookupService,
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

                try
                {
                    if (recordRideService is null)
                    {
                        row.ProcessingStatus = "imported";
                        job.ImportedRows += 1;
                    }
                    else
                    {
                        var request = BuildRecordRideRequest(row, enrichment);
                        if (request is null)
                        {
                            row.ProcessingStatus = "failed";
                            job.FailedRows += 1;
                        }
                        else
                        {
                            var (rideId, _) = await recordRideService.ExecuteAsync(
                                riderId,
                                request,
                                cancellationToken
                            );
                            row.CreatedRideId = rideId;
                            row.ProcessingStatus = "imported";
                            job.ImportedRows += 1;
                        }
                    }
                }
                catch
                {
                    row.ProcessingStatus = "failed";
                    job.FailedRows += 1;
                }

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
        catch (Exception ex)
        {
            await MarkAsFailedAsync(riderId, importJobId, ex.Message, cancellationToken);
        }
    }

    private async Task MarkAsFailedAsync(
        long riderId,
        long importJobId,
        string? errorMessage,
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
        job.LastError = string.IsNullOrWhiteSpace(errorMessage)
            ? "Import processing failed."
            : $"Import processing failed: {errorMessage}";
        job.CompletedAtUtc = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);

        await notifier.NotifyProgressAsync(
            CreateProgressNotification(job, riderId),
            cancellationToken
        );
    }

    private static RecordRideRequest? BuildRecordRideRequest(
        ImportRowEntity row,
        ImportEnrichmentLookup enrichment
    )
    {
        if (row.RideDateLocal is null || row.Miles is null)
        {
            return null;
        }

        var rideDate = row.RideDateLocal.Value;
        var weekStartDate = GasPriceWeekKeyHelper.GetWeekStartDate(rideDate);

        enrichment.GasPriceByWeek.TryGetValue(weekStartDate, out var gasPrice);
        enrichment.WeatherByDate.TryGetValue(rideDate, out var weather);

        var csvTemperature = row.Temperature;
        var finalTemperature = csvTemperature ?? weather?.Temperature;

        var rideDateTimeLocal = rideDate.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Local);

        return new RecordRideRequest(
            RideDateTimeLocal: rideDateTimeLocal,
            Miles: row.Miles.Value,
            RideMinutes: row.RideMinutes,
            Temperature: finalTemperature,
            GasPricePerGallon: gasPrice,
            WindSpeedMph: weather?.WindSpeedMph,
            WindDirectionDeg: weather?.WindDirectionDeg,
            RelativeHumidityPercent: weather?.RelativeHumidityPercent,
            CloudCoverPercent: weather?.CloudCoverPercent,
            PrecipitationType: weather?.PrecipitationType,
            Note: row.Notes,
            WeatherUserOverridden: csvTemperature.HasValue,
            Difficulty: row.Difficulty,
            PrimaryTravelDirection: row.PrimaryTravelDirection
        );
    }

    private static async Task<ImportEnrichmentLookup> PrefetchEnrichmentAsync(
        long riderId,
        IReadOnlyList<ImportRowEntity> rowsToProcess,
        BikeTrackingDbContext? dbContext,
        IGasPriceLookupService? gasLookupService,
        IWeatherLookupService? weatherLookupService,
        CancellationToken cancellationToken
    )
    {
        if (dbContext is null || gasLookupService is null || weatherLookupService is null)
        {
            return new ImportEnrichmentLookup(
                new Dictionary<DateOnly, decimal?>(),
                new Dictionary<DateOnly, WeatherData?>()
            );
        }

        try
        {
            var validRows = rowsToProcess
                .Where(static row => row.RideDateLocal is not null && row.Miles is not null)
                .ToArray();

            var distinctDates = validRows
                .Select(static row => row.RideDateLocal!.Value)
                .Distinct()
                .ToArray();
            var weekByDate = distinctDates.ToDictionary(
                static date => date,
                static date => GasPriceWeekKeyHelper.GetWeekStartDate(date)
            );
            var distinctWeeks = weekByDate.Values.Distinct().ToArray();

            var gasByWeek = await LoadGasLookupAsync(
                distinctDates,
                weekByDate,
                distinctWeeks,
                dbContext,
                gasLookupService,
                cancellationToken
            );

            var weatherByDate = await LoadWeatherLookupAsync(
                riderId,
                distinctDates,
                dbContext,
                weatherLookupService,
                cancellationToken
            );

            return new ImportEnrichmentLookup(gasByWeek, weatherByDate);
        }
        catch
        {
            // Enrichment must not fail the import job. Fall back to importing without enrichment.
            return new ImportEnrichmentLookup(
                new Dictionary<DateOnly, decimal?>(),
                new Dictionary<DateOnly, WeatherData?>()
            );
        }
    }

    private static async Task<Dictionary<DateOnly, decimal?>> LoadGasLookupAsync(
        IReadOnlyList<DateOnly> distinctDates,
        IReadOnlyDictionary<DateOnly, DateOnly> weekByDate,
        IReadOnlyList<DateOnly> distinctWeeks,
        BikeTrackingDbContext dbContext,
        IGasPriceLookupService gasLookupService,
        CancellationToken cancellationToken
    )
    {
        var gasByWeek = new Dictionary<DateOnly, decimal?>();

        if (distinctWeeks.Count == 0)
        {
            return gasByWeek;
        }

        var gasRows = await dbContext.GasPriceLookups.AsNoTracking().ToListAsync(cancellationToken);
        var cachedGas = gasRows
            .Where(x => distinctWeeks.Contains(x.WeekStartDate))
            .GroupBy(static x => x.WeekStartDate)
            .ToDictionary(
                static group => group.Key,
                static group =>
                    (decimal?)group.OrderByDescending(x => x.RetrievedAtUtc).First().PricePerGallon
            );

        foreach (var pair in cachedGas)
        {
            gasByWeek[pair.Key] = pair.Value;
        }

        var throttle = new SemaphoreSlim(MaxExternalCallsPerSecond, MaxExternalCallsPerSecond);
        var missingWeeks = distinctWeeks.Where(week => !gasByWeek.ContainsKey(week)).ToArray();

        foreach (var weekStart in missingWeeks)
        {
            var representativeDate = distinctDates.First(date => weekByDate[date] == weekStart);
            var value = await RetryWithThrottleAsync(
                throttle,
                async ct =>
                    await gasLookupService.GetOrFetchAsync(representativeDate, weekStart, ct),
                cancellationToken
            );
            gasByWeek[weekStart] = value;
        }

        return gasByWeek;
    }

    private static async Task<Dictionary<DateOnly, WeatherData?>> LoadWeatherLookupAsync(
        long riderId,
        IReadOnlyList<DateOnly> distinctDates,
        BikeTrackingDbContext dbContext,
        IWeatherLookupService weatherLookupService,
        CancellationToken cancellationToken
    )
    {
        var weatherByDate = new Dictionary<DateOnly, WeatherData?>();
        if (distinctDates.Count == 0)
        {
            return weatherByDate;
        }

        var userSettings = await dbContext
            .UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == riderId, cancellationToken);

        if (
            userSettings?.Latitude is not decimal latitude
            || userSettings.Longitude is not decimal longitude
        )
        {
            return weatherByDate;
        }

        var latRounded = Math.Round(latitude, 2);
        var lonRounded = Math.Round(longitude, 2);
        var noonLookupByDate = distinctDates.ToDictionary(
            static date => date,
            static date => new DateTime(date.Year, date.Month, date.Day, 12, 0, 0, DateTimeKind.Utc)
        );
        var noonLookupHours = noonLookupByDate.Values.ToArray();

        var weatherRows = await dbContext
            .WeatherLookups.AsNoTracking()
            .ToListAsync(cancellationToken);
        var cachedWeather = weatherRows
            .Where(x =>
                x.Status == "success"
                && x.LatitudeRounded == latRounded
                && x.LongitudeRounded == lonRounded
                && noonLookupHours.Contains(x.LookupHourUtc)
            )
            .ToArray();

        foreach (var cached in cachedWeather)
        {
            var date = DateOnly.FromDateTime(cached.LookupHourUtc);
            weatherByDate[date] = new WeatherData(
                cached.Temperature,
                cached.WindSpeedMph,
                cached.WindDirectionDeg,
                cached.RelativeHumidityPercent,
                cached.CloudCoverPercent,
                cached.PrecipitationType
            );
        }

        var throttle = new SemaphoreSlim(MaxExternalCallsPerSecond, MaxExternalCallsPerSecond);
        var missingDates = distinctDates.Where(date => !weatherByDate.ContainsKey(date)).ToArray();

        foreach (var date in missingDates)
        {
            var noonUtc = noonLookupByDate[date];
            var weather = await RetryWithThrottleAsync(
                throttle,
                async ct =>
                    await weatherLookupService.GetOrFetchAsync(latitude, longitude, noonUtc, ct),
                cancellationToken
            );
            weatherByDate[date] = weather;
        }

        return weatherByDate;
    }

    private static async Task<T?> RetryWithThrottleAsync<T>(
        SemaphoreSlim throttle,
        Func<CancellationToken, Task<T?>> action,
        CancellationToken cancellationToken
    )
        where T : class
    {
        for (var attempt = 0; attempt < MaxLookupAttempts; attempt++)
        {
            await AcquireThrottleSlotAsync(throttle, cancellationToken);
            var value = await action(cancellationToken);
            if (value is not null)
            {
                return value;
            }
        }

        return null;
    }

    private static async Task<decimal?> RetryWithThrottleAsync(
        SemaphoreSlim throttle,
        Func<CancellationToken, Task<decimal?>> action,
        CancellationToken cancellationToken
    )
    {
        for (var attempt = 0; attempt < MaxLookupAttempts; attempt++)
        {
            await AcquireThrottleSlotAsync(throttle, cancellationToken);
            var value = await action(cancellationToken);
            if (value is not null)
            {
                return value;
            }
        }

        return null;
    }

    private static async Task AcquireThrottleSlotAsync(
        SemaphoreSlim throttle,
        CancellationToken cancellationToken
    )
    {
        await throttle.WaitAsync(cancellationToken);
        _ = Task.Run(
            async () =>
            {
                await Task.Delay(ThrottleWindow, CancellationToken.None);
                throttle.Release();
            },
            CancellationToken.None
        );
    }

    private sealed record ImportEnrichmentLookup(
        Dictionary<DateOnly, decimal?> GasPriceByWeek,
        Dictionary<DateOnly, WeatherData?> WeatherByDate
    );

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
