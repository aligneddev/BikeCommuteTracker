using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;
using Microsoft.FSharp.Collections;
using Microsoft.FSharp.Core;

namespace BikeTracking.Api.Application.Dashboard;

internal static class RideDifficultyRules
{
    /// <summary>
    /// Projects rides into the F# snapshot list consumed by
    /// <see cref="AdvancedDashboardCalculations"/>.
    /// </summary>
    public static FSharpList<AdvancedDashboardCalculations.RideDifficultySnapshot> ToSnapshots(
        IEnumerable<RideEntity> rides
    )
    {
        var snapshots = rides.Select(ride => new AdvancedDashboardCalculations.RideDifficultySnapshot(
            RideDate: ride.RideDateTimeLocal,
            Difficulty: ride.Difficulty.HasValue
                ? FSharpOption<int>.Some(ride.Difficulty.Value)
                : FSharpOption<int>.None,
            WindResistanceRating: ride.WindResistanceRating.HasValue
                ? FSharpOption<int>.Some(ride.WindResistanceRating.Value)
                : FSharpOption<int>.None,
            WindSpeedMph: ride.WindSpeedMph.HasValue
                ? FSharpOption<decimal>.Some(ride.WindSpeedMph.Value)
                : FSharpOption<decimal>.None,
            PrimaryTravelDirection: ride.PrimaryTravelDirection is not null
                ? FSharpOption<string>.Some(ride.PrimaryTravelDirection)
                : FSharpOption<string>.None,
            WindDirectionDeg: ride.WindDirectionDeg.HasValue
                ? FSharpOption<int>.Some(ride.WindDirectionDeg.Value)
                : FSharpOption<int>.None
        ));

        return ListModule.OfSeq(snapshots);
    }

    public static string GetWindResistanceLabel(int rating) =>
        rating switch
        {
            -4 => "−4 (strong tailwind)",
            -3 => "−3 (tailwind)",
            -2 => "−2 (tailwind)",
            -1 => "−1 (light tailwind)",
            0 => "0 (neutral)",
            1 => "+1 (light headwind)",
            2 => "+2 (headwind)",
            3 => "+3 (headwind)",
            4 => "+4 (strong headwind)",
            _ => $"{(rating > 0 ? "+" : "")}{rating}",
        };
}
