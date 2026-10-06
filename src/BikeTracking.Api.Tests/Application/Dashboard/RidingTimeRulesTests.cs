using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Tests.Application.Dashboard;

public sealed class RidingTimeRulesTests
{
    [Fact]
    public void SumRecordedRideMinutes_WithNoRides_ReturnsZero()
    {
        Assert.Equal(0, RidingTimeRules.SumRecordedRideMinutes([]));
    }

    [Fact]
    public void SumRecordedRideMinutes_WithNoDurations_ReturnsZero()
    {
        var rides = new[] { CreateRide(null), CreateRide(null) };

        Assert.Equal(0, RidingTimeRules.SumRecordedRideMinutes(rides));
    }

    [Fact]
    public void SumRecordedRideMinutes_ExcludesRidesWithoutDuration()
    {
        var rides = new[] { CreateRide(45), CreateRide(null), CreateRide(30), CreateRide(90) };

        Assert.Equal(165, RidingTimeRules.SumRecordedRideMinutes(rides));
    }

    [Fact]
    public void SumRecordedRideMinutes_WithLargeTotal_DoesNotOverflow()
    {
        var rides = Enumerable.Range(0, 1000).Select(_ => CreateRide(63));

        Assert.Equal(63000, RidingTimeRules.SumRecordedRideMinutes(rides));
    }

    private static RideEntity CreateRide(int? rideMinutes) =>
        new()
        {
            RiderId = 1,
            RideDateTimeLocal = new DateTime(2026, 04, 16, 08, 00, 00, DateTimeKind.Local),
            Miles = 5m,
            RideMinutes = rideMinutes,
            CreatedAtUtc = new DateTime(2026, 04, 16, 12, 00, 00, DateTimeKind.Utc),
        };
}
