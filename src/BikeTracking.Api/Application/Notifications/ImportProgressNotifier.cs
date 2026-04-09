namespace BikeTracking.Api.Application.Notifications;

public sealed record ImportProgressNotification(
    long RiderId,
    long ImportJobId,
    string Status,
    int PercentComplete,
    int? EtaMinutesRounded,
    int ProcessedRows,
    int TotalRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows,
    DateTime EmittedAtUtc
);

public interface IImportProgressNotifier
{
    Task NotifyProgressAsync(
        ImportProgressNotification notification,
        CancellationToken cancellationToken
    );
}

public sealed class ImportProgressNotifier(ILogger<ImportProgressNotifier> logger)
    : IImportProgressNotifier
{
    private readonly ILogger<ImportProgressNotifier> _logger = logger;

    public Task NotifyProgressAsync(
        ImportProgressNotification notification,
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Import progress notification rider={RiderId} job={ImportJobId} status={Status} percent={PercentComplete} processed={ProcessedRows}/{TotalRows}",
            notification.RiderId,
            notification.ImportJobId,
            notification.Status,
            notification.PercentComplete,
            notification.ProcessedRows,
            notification.TotalRows
        );

        return Task.CompletedTask;
    }
}
