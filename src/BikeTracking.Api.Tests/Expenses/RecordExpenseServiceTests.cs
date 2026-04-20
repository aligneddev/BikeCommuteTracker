using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class RecordExpenseServiceTests
{
    [Fact]
    public async Task ExecuteAsync_WithAmountLessThanOrEqualToZero_ThrowsArgumentException()
    {
        await using var context = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(context, "amount-check");
        var receiptStorage = new SpyReceiptStorage();
        var service = new RecordExpenseService(
            context,
            receiptStorage,
            NullLogger<RecordExpenseService>.Instance
        );

        var request = new RecordExpenseRequest(DateTime.Today, 0m, null);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task ExecuteAsync_WithNoteLongerThanFiveHundredCharacters_ThrowsArgumentException()
    {
        await using var context = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(context, "notes-check");
        var receiptStorage = new SpyReceiptStorage();
        var service = new RecordExpenseService(
            context,
            receiptStorage,
            NullLogger<RecordExpenseService>.Instance
        );

        var request = new RecordExpenseRequest(DateTime.Today, 19.95m, new string('n', 501));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task ExecuteAsync_WithValidRequest_PersistsExpenseAndReturnsResponse()
    {
        await using var context = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(context, "save-check");
        var receiptStorage = new SpyReceiptStorage();
        var service = new RecordExpenseService(
            context,
            receiptStorage,
            NullLogger<RecordExpenseService>.Instance
        );

        var request = new RecordExpenseRequest(DateTime.Today, 49.95m, "New tube");

        var response = await service.ExecuteAsync(user.UserId, request);

        Assert.True(response.ExpenseId > 0);
        Assert.Equal(user.UserId, response.RiderId);
        Assert.False(response.ReceiptAttached);

        var persisted = await context.Expenses.SingleAsync();
        Assert.Equal(user.UserId, persisted.RiderId);
        Assert.Equal(DateTime.Today, persisted.ExpenseDate);
        Assert.Equal(49.95m, persisted.Amount);
        Assert.Equal("New tube", persisted.Notes);
        Assert.Null(persisted.ReceiptPath);
    }

    [Fact]
    public async Task ExecuteAsync_WithReceipt_SavesFileAndPersistsReceiptPath()
    {
        await using var context = TestFactories.CreateDbContext();
        var user = await SeedUserAsync(context, "receipt-check");
        var receiptStorage = new SpyReceiptStorage();
        var service = new RecordExpenseService(
            context,
            receiptStorage,
            NullLogger<RecordExpenseService>.Instance
        );
        await using var receiptStream = new MemoryStream("stub"u8.ToArray());

        var response = await service.ExecuteAsync(
            user.UserId,
            new RecordExpenseRequest(DateTime.Today, 12.5m, "Chain oil"),
            "receipt.png",
            receiptStream
        );

        Assert.True(response.ReceiptAttached);
        Assert.Equal(1, receiptStorage.SaveCallCount);

        var persisted = await context.Expenses.SingleAsync();
        Assert.Equal(receiptStorage.StoredRelativePath, persisted.ReceiptPath);
    }

    private static async Task<UserEntity> SeedUserAsync(BikeTrackingDbContext context, string name)
    {
        var user = new UserEntity
        {
            DisplayName = name,
            NormalizedName = name.ToLowerInvariant(),
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true,
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    private sealed class SpyReceiptStorage : IReceiptStorage
    {
        public int SaveCallCount { get; private set; }

        public string StoredRelativePath { get; } = "receipts/stub.png";

        public Task<string> SaveAsync(long riderId, long expenseId, string filename, Stream stream)
        {
            SaveCallCount += 1;
            return Task.FromResult(StoredRelativePath);
        }

        public Task DeleteAsync(string relativePath) => Task.CompletedTask;

        public Task<Stream> GetAsync(string relativePath) =>
            Task.FromResult<Stream>(new MemoryStream());
    }
}
