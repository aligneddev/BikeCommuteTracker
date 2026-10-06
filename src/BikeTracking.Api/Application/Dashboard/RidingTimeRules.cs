using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Dashboard;

internal static class RidingTimeRules
{
    /// <summary>
    /// Sums the recorded ride durations in minutes. Rides without a duration are excluded (FR-004).
    /// </summary>
    public static int SumRecordedRideMinutes(IEnumerable<RideEntity> rides)
    {
        return rides.Where(r => r.RideMinutes.HasValue).Sum(r => r.RideMinutes!.Value);
    }
}
