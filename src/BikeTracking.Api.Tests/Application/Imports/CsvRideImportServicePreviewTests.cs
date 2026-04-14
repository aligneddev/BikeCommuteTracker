using System.Text;
using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class CsvRideImportServicePreviewTests
{
    [Fact]
    public async Task PreviewAsync_WithUtf8BomCsvContent_ParsesRows()
    {
        var service = CreateService();
        var csv = "Date,Miles,Time,Temp,Tags,Notes\r\n1/6/2026,4.35,,21,,\r\n";
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();

        var result = await service.PreviewAsync(
            riderId: 42,
            new ImportPreviewRequest("rides.csv", Convert.ToBase64String(bytes)),
            CancellationToken.None
        );

        Assert.Equal(1, result.TotalRows);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal("1/6/2026", result.Rows[0].Date);
        Assert.Equal(4.35m, result.Rows[0].Miles);
        Assert.Equal(21m, result.Rows[0].Temperature);
    }

    [Fact]
    public async Task PreviewAsync_WithUtf16LeBomCsvContent_ParsesRows()
    {
        var service = CreateService();
        var csv = "Date,Miles,Time,Temp,Tags,Notes\r\n1/7/2026,4.35,,29,,\r\n";
        var bytes = Encoding.Unicode.GetPreamble().Concat(Encoding.Unicode.GetBytes(csv)).ToArray();

        var result = await service.PreviewAsync(
            riderId: 42,
            new ImportPreviewRequest("rides.csv", Convert.ToBase64String(bytes)),
            CancellationToken.None
        );

        Assert.Equal(1, result.TotalRows);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal("1/7/2026", result.Rows[0].Date);
        Assert.Equal(4.35m, result.Rows[0].Miles);
        Assert.Equal(29m, result.Rows[0].Temperature);
    }

    [Fact]
    public async Task PreviewAsync_WithFullyEmptyCsvRow_SkipsEmptyRow()
    {
        var service = CreateService();
        var csv = "Date,Miles,Time,Temp,Tags,Notes\r\n1/7/2026,4.35,,29,,\r\n,,,,,\r\n";
        var bytes = Encoding.UTF8.GetBytes(csv);

        var result = await service.PreviewAsync(
            riderId: 42,
            new ImportPreviewRequest("rides.csv", Convert.ToBase64String(bytes)),
            CancellationToken.None
        );

        Assert.Equal(1, result.TotalRows);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal(0, result.InvalidRows);
        Assert.Single(result.Rows);
        Assert.Equal("1/7/2026", result.Rows[0].Date);
    }

    private static CsvRideImportService CreateService()
    {
        return new CsvRideImportService(
            new TestImportJobRepository(),
            new EmptyDuplicateResolutionService(),
            new NoOpImportJobProcessor()
        );
    }

    private sealed class TestImportJobRepository : IImportJobRepository
    {
        private long _nextJobId = 1;

        public Task<ImportJobEntity> CreateJobAsync(
            long riderId,
            string fileName,
            int totalRows,
            int invalidRows,
            CancellationToken cancellationToken
        )
        {
            var entity = new ImportJobEntity
            {
                Id = _nextJobId++,
                RiderId = riderId,
                FileName = fileName,
                TotalRows = totalRows,
                ProcessedRows = 0,
                ImportedRows = 0,
                SkippedRows = 0,
                FailedRows = invalidRows,
                Status = "awaiting-confirmation",
                CreatedAtUtc = DateTime.UtcNow,
            };

            return Task.FromResult(entity);
        }

        public Task AddRowsAsync(
            long importJobId,
            IReadOnlyList<ImportRowEntity> rows,
            CancellationToken cancellationToken
        ) => Task.CompletedTask;

        public Task<ImportJobEntity?> GetJobAsync(
            long riderId,
            long importJobId,
            CancellationToken cancellationToken
        ) => Task.FromResult<ImportJobEntity?>(null);

        public Task<ImportJobEntity?> GetJobReadOnlyAsync(
            long riderId,
            long importJobId,
            CancellationToken cancellationToken
        ) => Task.FromResult<ImportJobEntity?>(null);

        public Task<bool> HasActiveImportAsync(
            long riderId,
            long excludeJobId,
            CancellationToken cancellationToken
        ) => Task.FromResult(false);

        public Task<IReadOnlyList<ImportRowEntity>> GetJobRowsAsync(
            long importJobId,
            CancellationToken cancellationToken
        ) => Task.FromResult<IReadOnlyList<ImportRowEntity>>([]);

        public Task<IReadOnlyList<ImportRowEntity>> GetPendingRowsAsync(
            long importJobId,
            CancellationToken cancellationToken
        ) => Task.FromResult<IReadOnlyList<ImportRowEntity>>([]);

        public Task ReloadJobAsync(ImportJobEntity job, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class EmptyDuplicateResolutionService : IDuplicateResolutionService
    {
        public Task<
            IReadOnlyDictionary<int, IReadOnlyList<ImportDuplicateMatch>>
        > GetDuplicateMatchesAsync(
            long riderId,
            IReadOnlyList<ImportDuplicateCandidate> candidates,
            CancellationToken cancellationToken
        )
        {
            IReadOnlyDictionary<int, IReadOnlyList<ImportDuplicateMatch>> lookup =
                new Dictionary<int, IReadOnlyList<ImportDuplicateMatch>>();
            return Task.FromResult(lookup);
        }
    }

    private sealed class NoOpImportJobProcessor : IImportJobProcessor
    {
        public void Enqueue(long riderId, long importJobId) { }
    }
}
