using BikeTracking.Api.Application.Expenses;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class EditExpenseServiceTests
{
    [Fact]
    public async Task ExecuteAsync_WithVersionMismatch_ReturnsConflictWithCurrentVersion()
    {
        await using var context = TestFactories.CreateDbContext();
        var rider = await SeedUserAsync(context, "edit-conflict");
        var expense = await SeedExpenseAsync(context, rider.UserId, amount: 18.25m, version: 3);
        var service = new EditExpenseService(context, NullLogger<EditExpenseService>.Instance);

        var result = await service.ExecuteAsync(
            rider.UserId,
            expense.Id,
            new EditExpenseRequest(DateTime.Today, 19.0m, "Updated", ExpectedVersion: 2)
        );

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal("EXPENSE_VERSION_CONFLICT", result.Error.Code);
        Assert.Equal(3, result.Error.CurrentVersion);
    }

    [Fact]
    public async Task ExecuteAsync_WithValidRequest_UpdatesFieldsAndIncrementsVersion()
    {
        await using var context = TestFactories.CreateDbContext();
        var rider = await SeedUserAsync(context, "edit-success");
        var expense = await SeedExpenseAsync(context, rider.UserId, amount: 22.15m, version: 1);
        var service = new EditExpenseService(context, NullLogger<EditExpenseService>.Instance);

        var request = new EditExpenseRequest(DateTime.Today.AddDays(-1), 27.5m, "New notes", 1);

        var result = await service.ExecuteAsync(rider.UserId, expense.Id, request);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Response);
        Assert.Equal(expense.Id, result.Response.ExpenseId);
        Assert.Equal(2, result.Response.NewVersion);

        var persisted = await context.Expenses.SingleAsync(entity => entity.Id == expense.Id);
        Assert.Equal(request.ExpenseDate, persisted.ExpenseDate);
        Assert.Equal(request.Amount, persisted.Amount);
        Assert.Equal(request.Notes, persisted.Notes);
        Assert.Equal(2, persisted.Version);
    }

    [Fact]
    public async Task ExecuteAsync_WithInvalidAmount_ReturnsValidationFailure()
    {
        await using var context = TestFactories.CreateDbContext();
        var rider = await SeedUserAsync(context, "edit-validate");
        var expense = await SeedExpenseAsync(context, rider.UserId, amount: 8.75m, version: 1);
        var service = new EditExpenseService(context, NullLogger<EditExpenseService>.Instance);

        var result = await service.ExecuteAsync(
            rider.UserId,
            expense.Id,
            new EditExpenseRequest(DateTime.Today, 0m, "Bad amount", ExpectedVersion: 1)
        );

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal("VALIDATION_FAILED", result.Error.Code);

        var persisted = await context.Expenses.SingleAsync(entity => entity.Id == expense.Id);
        Assert.Equal(8.75m, persisted.Amount);
        Assert.Equal(1, persisted.Version);
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
        decimal amount,
        int version
    )
    {
        var expense = new ExpenseEntity
        {
            RiderId = riderId,
            ExpenseDate = DateTime.Today,
            Amount = amount,
            Notes = "Original note",
            IsDeleted = false,
            Version = version,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        context.Expenses.Add(expense);
        await context.SaveChangesAsync();
        return expense;
    }
}
