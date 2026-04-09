using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Imports;

public interface IImportJobRepository
{
    Task<ImportJobEntity> CreateJobAsync(
        long riderId,
        string fileName,
        int totalRows,
        int invalidRows,
        CancellationToken cancellationToken
    );

    Task AddRowsAsync(
        long importJobId,
        IReadOnlyList<ImportRowEntity> rows,
        CancellationToken cancellationToken
    );

    Task<ImportJobEntity?> GetJobAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    );

    Task<ImportJobEntity?> GetJobReadOnlyAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    );

    Task<bool> HasActiveImportAsync(
        long riderId,
        long excludeJobId,
        CancellationToken cancellationToken
    );

    Task<IReadOnlyList<ImportRowEntity>> GetJobRowsAsync(
        long importJobId,
        CancellationToken cancellationToken
    );

    Task<IReadOnlyList<ImportRowEntity>> GetPendingRowsAsync(
        long importJobId,
        CancellationToken cancellationToken
    );

    Task ReloadJobAsync(ImportJobEntity job, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
