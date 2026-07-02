using System.Text;
using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class MonthlySummaryImportServiceTests
{
    private static string ToBase64(string text) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(text));

    // --- Year assignment (T015) ---

    [Fact]
    public async Task PreviewAsync_AllMonthsWithinOneYear_AssignsStartYearToEveryRow()
    {
        var service = CreateService(out _, out _);
        var text = "Month\tMiles\tDays\nJanuary\t96\t8\nFebruary\t60\t5\nMarch\t120\t10\n";

        var response = await service.PreviewAsync(
            1,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.All(response.MonthRows, row => Assert.Equal(2025, row.Year));
    }

    [Fact]
    public async Task PreviewAsync_DecemberToJanuaryBoundary_AssignsStartYearToDecemberAndNextYearToJanuary()
    {
        var service = CreateService(out _, out _);
        var text = "Month\tMiles\tDays\nDecember\t100\t8\nJanuary\t60\t5\n";

        var response = await service.PreviewAsync(
            1,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.Equal(2025, response.MonthRows[0].Year);
        Assert.Equal(2026, response.MonthRows[1].Year);
    }

    [Fact]
    public async Task PreviewAsync_NovemberToFebruarySequenceStarting2025_AssignsYearsAcrossBoundary()
    {
        var service = CreateService(out _, out _);
        var text =
            "Month\tMiles\tDays\nNovember\t80\t7\nDecember\t100\t8\nJanuary\t60\t5\nFebruary\t50\t4\n";

        var response = await service.PreviewAsync(
            1,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.Equal(2025, response.MonthRows[0].Year); // November
        Assert.Equal(2025, response.MonthRows[1].Year); // December
        Assert.Equal(2026, response.MonthRows[2].Year); // January
        Assert.Equal(2026, response.MonthRows[3].Year); // February
    }

    [Fact]
    public async Task PreviewAsync_TwelveMonthSequenceWithNoBoundary_StaysOnStartYear()
    {
        var service = CreateService(out _, out _);
        var text = "Month\tMiles\tDays\nJanuary\t96\t8\nFebruary\t60\t5\n";

        var response = await service.PreviewAsync(
            1,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.All(response.MonthRows, row => Assert.Equal(2025, row.Year));
    }

    // --- Preview happy path (T016) ---

    [Fact]
    public async Task PreviewAsync_ThreeMonthSample_CreatesImportJobAndMatchingRows()
    {
        var service = CreateService(out var repository, out _);
        var text = "Month\tMiles\tDays\nJanuary\t96\t8\nFebruary\t60\t5\nMarch\t120\t10\n";

        var response = await service.PreviewAsync(
            7,
            new MonthlyImportPreviewRequest("sample-3months.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.Equal("monthly-summary", repository.CreatedJob!.ImportType);
        Assert.Equal(7, repository.CreatedJob!.RiderId);
        Assert.Equal(23, repository.AddedRows.Count); // 8 + 5 + 10
        Assert.Equal(23, response.TotalGeneratedRides);
        Assert.Equal(3, response.TotalMonthRows);
        Assert.Equal(3, response.ValidMonthRows);
        Assert.Equal(0, response.InvalidMonthRows);

        var januaryRow = response.MonthRows[0];
        Assert.True(januaryRow.IsValid);
        Assert.Equal(8, januaryRow.GeneratedRides.Count);
        Assert.Equal(96.00m, januaryRow.GeneratedRides.Sum(ride => ride.Miles));
    }

    // --- Duplicate detection (T017) ---

    [Fact]
    public async Task PreviewAsync_ExistingRideOnGeneratedDate_MarksDuplicateAndPopulatesMatches()
    {
        using var dbContext = TestFactories.CreateDbContext();
        const long riderId = 42;

        // Generate rides first (without seeding) to discover which date is generated.
        var probeService = new MonthlySummaryImportService(
            dbContext,
            new TestImportJobRepository(),
            new NoOpImportJobProcessor()
        );
        var text = "Month\tMiles\tDays\nMay\t96\t8\n";
        var probeResponse = await probeService.PreviewAsync(
            riderId,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );
        var firstGeneratedDate = DateOnly.Parse(probeResponse.MonthRows[0].GeneratedRides[0].Date);

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = riderId,
                RideDateTimeLocal = firstGeneratedDate.ToDateTime(new TimeOnly(12, 0)),
                Miles = 5.5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new MonthlySummaryImportService(
            dbContext,
            new TestImportJobRepository(),
            new NoOpImportJobProcessor()
        );

        var response = await service.PreviewAsync(
            riderId,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        var generatedRides = response.MonthRows[0].GeneratedRides;
        var duplicateRide = Assert.Single(generatedRides, ride => ride.IsDuplicate);
        Assert.Equal(firstGeneratedDate.ToString("yyyy-MM-dd"), duplicateRide.Date);
        Assert.NotEmpty(duplicateRide.DuplicateMatches);

        Assert.Contains(generatedRides, ride => !ride.IsDuplicate);
        Assert.Equal(1, response.DuplicateRides);
        Assert.True(response.RequiresDuplicateResolution);
    }

    [Fact]
    public async Task PreviewAsync_NoCollidingRides_MarksAllAsNotDuplicate()
    {
        using var dbContext = TestFactories.CreateDbContext();
        var service = new MonthlySummaryImportService(
            dbContext,
            new TestImportJobRepository(),
            new NoOpImportJobProcessor()
        );
        var text = "Month\tMiles\tDays\nMay\t96\t8\n";

        var response = await service.PreviewAsync(
            42,
            new MonthlyImportPreviewRequest("paste.txt", ToBase64(text), 2025),
            CancellationToken.None
        );

        Assert.All(response.MonthRows[0].GeneratedRides, ride => Assert.False(ride.IsDuplicate));
        Assert.Equal(0, response.DuplicateRides);
        Assert.False(response.RequiresDuplicateResolution);
    }

    private static MonthlySummaryImportService CreateService(
        out TestImportJobRepository repository,
        out BikeTracking.Api.Infrastructure.Persistence.BikeTrackingDbContext dbContext
    )
    {
        dbContext = TestFactories.CreateDbContext();
        repository = new TestImportJobRepository();
        return new MonthlySummaryImportService(dbContext, repository, new NoOpImportJobProcessor());
    }

    private sealed class TestImportJobRepository : IImportJobRepository
    {
        private long _nextJobId = 1;

        public ImportJobEntity? CreatedJob { get; private set; }

        public List<ImportRowEntity> AddedRows { get; } = [];

        public Task<ImportJobEntity> CreateJobAsync(
            long riderId,
            string fileName,
            int totalRows,
            int invalidRows,
            string importType,
            CancellationToken cancellationToken
        )
        {
            var entity = new ImportJobEntity
            {
                Id = _nextJobId++,
                RiderId = riderId,
                FileName = fileName,
                ImportType = importType,
                TotalRows = totalRows,
                ProcessedRows = 0,
                ImportedRows = 0,
                SkippedRows = 0,
                FailedRows = invalidRows,
                Status = "awaiting-confirmation",
                CreatedAtUtc = DateTime.UtcNow,
            };
            CreatedJob = entity;
            return Task.FromResult(entity);
        }

        public Task AddRowsAsync(
            long importJobId,
            IReadOnlyList<ImportRowEntity> rows,
            CancellationToken cancellationToken
        )
        {
            AddedRows.AddRange(rows);
            return Task.CompletedTask;
        }

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

    private sealed class NoOpImportJobProcessor : IImportJobProcessor
    {
        public void Enqueue(long riderId, long importJobId) { }
    }
}
