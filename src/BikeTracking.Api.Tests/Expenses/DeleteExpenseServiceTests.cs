using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class DeleteExpenseServiceTests
{
    [Fact]
    public async Task ExecuteAsync_WithActiveExpense_TombstonesExpenseAndDeletesReceipt()
    {
        await using var context = TestFactories.CreateDbContext();
        var rider = await SeedUserAsync(context, "delete-success");
        var expense = await SeedExpenseAsync(context, rider.UserId, receiptPath: "1/2/receipt.png");
        var receiptStorage = new SpyReceiptStorage();
        var service = new DeleteExpenseService(
            context,
            receiptStorage,
            NullLogger<DeleteExpenseService>.Instance
        );

        var result = await service.ExecuteAsync(rider.UserId, expense.Id);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Response);

        var persisted = await context.Expenses.SingleAsync(entity => entity.Id == expense.Id);
        Assert.True(persisted.IsDeleted);
        Assert.Equal("1/2/receipt.png", receiptStorage.DeletedPath);
    }

    [Fact]
    public async Task ExecuteAsync_WithDeletedExpense_ReturnsAlreadyDeletedError()
    {
        await using var context = TestFactories.CreateDbContext();
        var rider = await SeedUserAsync(context, "delete-already");
        var expense = await SeedExpenseAsync(context, rider.UserId, receiptPath: null);
        expense.IsDeleted = true;
        await context.SaveChangesAsync();

        var service = new DeleteExpenseService(
            context,
            new SpyReceiptStorage(),
            NullLogger<DeleteExpenseService>.Instance
        );

        var result = await service.ExecuteAsync(rider.UserId, expense.Id);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal("EXPENSE_ALREADY_DELETED", result.Error.Code);
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

    private static async Task<ExpenseEntity> SeedExpenseAsync(
        BikeTrackingDbContext context,
        long riderId,
        string? receiptPath
    )
    {
        var expense = new ExpenseEntity
        {
            RiderId = riderId,
            ExpenseDate = DateTime.Today,
            Amount = 11.25m,
            Notes = "Delete me",
            ReceiptPath = receiptPath,
            IsDeleted = false,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        context.Expenses.Add(expense);
        await context.SaveChangesAsync();
        return expense;
    }

    private sealed class SpyReceiptStorage : IReceiptStorage
    {
        public string? DeletedPath { get; private set; }

        public Task<string> SaveAsync(long riderId, long expenseId, string filename, Stream stream)
        {
            throw new NotSupportedException("Not used in delete tests.");
        }

        public Task DeleteAsync(string relativePath)
        {
            DeletedPath = relativePath;
            return Task.CompletedTask;
        }

        public Task<Stream> GetAsync(string relativePath)
        {
            throw new NotSupportedException("Not used in delete tests.");
        }
    }
}
