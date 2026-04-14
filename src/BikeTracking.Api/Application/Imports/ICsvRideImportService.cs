using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Application.Imports;

public interface ICsvRideImportService
{
    Task<ImportPreviewResponse> PreviewAsync(
        long riderId,
        ImportPreviewRequest request,
        CancellationToken cancellationToken
    );

    Task<ImportStartResponse> StartAsync(
        long riderId,
        ImportStartRequest request,
        CancellationToken cancellationToken
    );

    Task<ImportStatusResponse?> GetStatusAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    );

    Task<ImportCancelResponse?> CancelAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    );
}
