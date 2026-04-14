namespace BikeTracking.Api.Application.Notifications;

using Microsoft.AspNetCore.SignalR;

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

public sealed class ImportProgressNotifier(
    ILogger<ImportProgressNotifier> logger,
    IHubContext<ImportProgressHub>? hubContext = null
) : IImportProgressNotifier
{
    private readonly ILogger<ImportProgressNotifier> _logger = logger;
    private readonly IHubContext<ImportProgressHub>? _hubContext = hubContext;

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

        if (_hubContext is null)
        {
            return Task.CompletedTask;
        }

        var group = ImportProgressGroups.RiderJob(notification.RiderId, notification.ImportJobId);
        return _hubContext
            .Clients.Group(group)
            .SendAsync("import.progress", notification, cancellationToken);
    }
}
