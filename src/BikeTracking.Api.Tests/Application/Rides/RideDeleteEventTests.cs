namespace BikeTracking.Api.Tests.Application.Rides;

using BikeTracking.Api.Application.Events;
using Xunit;

/// <summary>
/// TDD RED-GREEN: Tests for RideDeleted event definition.
/// These tests should FAIL initially (event not yet defined).
/// STATUS: RED (event type not yet implemented)
/// </summary>
public class RideDeleteEventTests
{
    [Fact]
    public void RideDeletedEventPayload_Create_WithValidParameters_ReturnsEvent()
    {
        // Arrange
        long riderId = 42;
        long rideId = 100;
        var deletedAtUtc = DateTime.UtcNow;

        // Act
        var evt = RideDeletedEventPayload.Create(
            riderId: riderId,
            rideId: rideId,
            deletedAtUtc: deletedAtUtc
        );

        // Assert
        Assert.NotNull(evt);
        Assert.Equal("RideDeleted", evt.EventType);
        Assert.Equal("RideDeleted", RideDeletedEventPayload.EventTypeName);
        Assert.Equal(riderId, evt.RiderId);
        Assert.Equal(rideId, evt.RideId);
        Assert.Equal(deletedAtUtc, evt.OccurredAtUtc);
    }

    [Fact]
    public void RideDeletedEventPayload_HasRequiredFields()
    {
        // Arrange & Act
        var evt = RideDeletedEventPayload.Create(riderId: 42, rideId: 100);

        // Assert
        Assert.NotEmpty(evt.EventId);
        Assert.Equal("RideDeleted", evt.EventType);
        Assert.NotEqual(default, evt.OccurredAtUtc);
        Assert.Equal(RideDeletedEventPayload.SourceName, evt.Source);
    }

    [Fact]
    public void RideDeletedEventPayload_EventTypeConstant_IsCorrect()
    {
        // Assert
        Assert.Equal("RideDeleted", RideDeletedEventPayload.EventTypeName);
    }

    [Fact]
    public void RideDeletedEventPayload_SourceName_IsCorrect()
    {
        // Assert
        Assert.Equal("BikeTracking.Api", RideDeletedEventPayload.SourceName);
    }
}
