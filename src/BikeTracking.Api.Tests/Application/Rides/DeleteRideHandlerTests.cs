namespace BikeTracking.Api.Tests.Application.Rides;

using Xunit;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

/// <summary>
/// TDD RED-GREEN: Tests for delete handler logic.
/// These tests should FAIL initially (handler not yet implemented).
/// STATUS: RED
/// </summary>
public class DeleteRideHandlerTests
{
    private BikeTrackingDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new BikeTrackingDbContext(options);
    }

    private ILogger<DeleteRideHandler> CreateMockLogger()
    {
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        return loggerFactory.CreateLogger<DeleteRideHandler>();
    }

    [Fact]
    public async Task DeleteRideAsync_WithValidOwnedRide_CreatesDeleteEvent()
    {
        // Arrange
        var dbContext = CreateInMemoryDbContext();
        var handler = new DeleteRideHandler(dbContext, CreateMockLogger());
        
        long userId = 42;
        long rideId = 100;
        
        // Create a test ride
        var ride = new RideEntity
        {
            Id = (int)rideId,
            RiderId = userId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5.5m,
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.Rides.Add(ride);
        await dbContext.SaveChangesAsync();

        // Act
        var result = await handler.DeleteRideAsync(userId, rideId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(rideId, result.RideId);
        Assert.Equal(userId, result.UserId);
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task DeleteRideAsync_NonExistentRide_ReturnsNotFound()
    {
        // Arrange
        var dbContext = CreateInMemoryDbContext();
        var handler = new DeleteRideHandler(dbContext, CreateMockLogger());
        
        long userId = 42;
        long nonExistentRideId = 9999;

        // Act
        var result = await handler.DeleteRideAsync(userId, nonExistentRideId);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsSuccess);
        Assert.Equal("RIDE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task DeleteRideAsync_NonOwnerAttempt_ReturnsForbidden()
    {
        // Arrange
        var dbContext = CreateInMemoryDbContext();
        var handler = new DeleteRideHandler(dbContext, CreateMockLogger());
        
        long rideOwnerId = 42;
        long attackerId = 99;
        long rideId = 100;
        
        // Create ride owned by rideOwnerId
        var ride = new RideEntity
        {
            Id = (int)rideId,
            RiderId = rideOwnerId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5.5m,
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.Rides.Add(ride);
        await dbContext.SaveChangesAsync();

        // Act - attempt delete as different user
        var result = await handler.DeleteRideAsync(attackerId, rideId);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_RIDE_OWNER", result.ErrorCode);
    }

    [Fact]
    public async Task DeleteRideAsync_AlreadyDeletedRide_IsIdempotent()
    {
        // Arrange
        var dbContext = CreateInMemoryDbContext();
        var handler = new DeleteRideHandler(dbContext, CreateMockLogger());
        
        long userId = 42;
        long rideId = 100;
        
        // Create and delete a ride once
        var ride = new RideEntity
        {
            Id = (int)rideId,
            RiderId = userId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5.5m,
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.Rides.Add(ride);
        await dbContext.SaveChangesAsync();

        // First delete
        var firstResult = await handler.DeleteRideAsync(userId, rideId);
        Assert.True(firstResult.IsSuccess);

        // Act - try to delete again
        var secondResult = await handler.DeleteRideAsync(userId, rideId);

        // Assert - should succeed (idempotent)
        Assert.NotNull(secondResult);
        Assert.True(secondResult.IsSuccess);
        Assert.True(secondResult.IsIdempotent);
    }

    [Fact]
    public async Task DeleteRideAsync_WritesEventToOutbox()
    {
        // Arrange
        var dbContext = CreateInMemoryDbContext();
        var handler = new DeleteRideHandler(dbContext, CreateMockLogger());
        
        long userId = 42;
        long rideId = 100;
        
        var ride = new RideEntity
        {
            Id = (int)rideId,
            RiderId = userId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5.5m,
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.Rides.Add(ride);
        await dbContext.SaveChangesAsync();

        // Act
        var result = await handler.DeleteRideAsync(userId, rideId);

        // Assert
        Assert.True(result.IsSuccess);
        // Verify outbox entry was created
        var outboxEntries = await dbContext.OutboxEvents
            .Where(x => x.EventType == "RideDeleted" && x.AggregateId == rideId)
            .ToListAsync();
        Assert.NotEmpty(outboxEntries);
    }
}
