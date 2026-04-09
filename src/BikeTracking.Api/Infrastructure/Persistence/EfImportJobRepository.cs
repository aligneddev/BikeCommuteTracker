using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Infrastructure.Persistence;

public sealed class EfImportJobRepository(BikeTrackingDbContext dbContext) : IImportJobRepository
{
    public async Task<ImportJobEntity> CreateJobAsync(
        long riderId,
        string fileName,
        int totalRows,
        int invalidRows,
        CancellationToken cancellationToken
    )
    {
        var job = new ImportJobEntity
        {
            RiderId = riderId,
            FileName = fileName,
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
        return job;
    }

    public async Task AddRowsAsync(
        long importJobId,
        IReadOnlyList<ImportRowEntity> rows,
        CancellationToken cancellationToken
    )
    {
        foreach (var row in rows)
        {
            row.ImportJobId = importJobId;
        }

        dbContext.ImportRows.AddRange(rows);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<ImportJobEntity?> GetJobAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return await dbContext.ImportJobs.SingleOrDefaultAsync(
            x => x.Id == importJobId && x.RiderId == riderId,
            cancellationToken
        );
    }

    public async Task<ImportJobEntity?> GetJobReadOnlyAsync(
        long riderId,
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return await dbContext
            .ImportJobs.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == importJobId && x.RiderId == riderId,
                cancellationToken
            );
    }

    public async Task<bool> HasActiveImportAsync(
        long riderId,
        long excludeJobId,
        CancellationToken cancellationToken
    )
    {
        return await dbContext.ImportJobs.AnyAsync(
            x => x.RiderId == riderId && x.Status == "processing" && x.Id != excludeJobId,
            cancellationToken
        );
    }

    public async Task<IReadOnlyList<ImportRowEntity>> GetJobRowsAsync(
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return await dbContext
            .ImportRows.Where(x => x.ImportJobId == importJobId)
            .OrderBy(x => x.RowNumber)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ImportRowEntity>> GetPendingRowsAsync(
        long importJobId,
        CancellationToken cancellationToken
    )
    {
        return await dbContext
            .ImportRows.Where(x => x.ImportJobId == importJobId && x.ProcessingStatus == "pending")
            .OrderBy(x => x.RowNumber)
            .ToListAsync(cancellationToken);
    }

    public async Task ReloadJobAsync(ImportJobEntity job, CancellationToken cancellationToken)
    {
        await dbContext.Entry(job).ReloadAsync(cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
