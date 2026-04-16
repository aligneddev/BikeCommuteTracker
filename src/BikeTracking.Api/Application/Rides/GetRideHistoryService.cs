using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

/// <summary>
/// Provides query operations for retrieving ride history with filtering, summaries, and pagination.
/// </summary>
public sealed class GetRideHistoryService(BikeTrackingDbContext dbContext)
{
    /// <summary>
    /// Retrieves paginated ride history with summary totals for a specific rider.
    /// </summary>
    /// <param name="riderId">Authenticated rider ID.</param>
    /// <param name="fromDate">Inclusive start date (local date). Null means unbounded start.</param>
    /// <param name="toDate">Inclusive end date (local date). Null means unbounded end.</param>
    /// <param name="page">1-based page number. Defaults to 1.</param>
    /// <param name="pageSize">Rows per page. Defaults to 25, max 200.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Ride history response with summaries, filtered rows, and pagination info.</returns>
    /// <exception cref="ArgumentException">If from > to.</exception>
    public async Task<RideHistoryResponse> GetRideHistoryAsync(
        long riderId,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default
    )
    {
        // Enforce pageSize bounds
        pageSize = Math.Clamp(pageSize, 1, 200);
        page = Math.Max(page, 1);

        // Validate date range: from <= to
        if (fromDate.HasValue && toDate.HasValue && fromDate > toDate)
        {
            throw new ArgumentException(
                "Invalid date range: from date must be <= to date",
                nameof(fromDate)
            );
        }

        // Get all rides for this rider (will filter in memory for date calculations)
        var allRides = await dbContext
            .Rides.Where(r => r.RiderId == riderId)
            .OrderByDescending(r => r.RideDateTimeLocal)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Calculate period boundaries in local dates (assuming rides are stored in rider's local time)
        var today = DateOnly.FromDateTime(DateTime.Now);
        var firstOfMonth = new DateOnly(today.Year, today.Month, 1);
        var firstOfYear = new DateOnly(today.Year, 1, 1);

        // Helper: Convert ride date to DateOnly
        static DateOnly GetRideDate(DateTime rideDateTime) => DateOnly.FromDateTime(rideDateTime);

        // Summaries for navigation periods (always unfiltered)
        var thisMonthRides = allRides.Where(r =>
            GetRideDate(r.RideDateTimeLocal) >= firstOfMonth
            && GetRideDate(r.RideDateTimeLocal) <= today
        );

        var thisMonthSummary = new MileageSummary(
            Miles: thisMonthRides.Sum(r => r.Miles),
            RideCount: thisMonthRides.Count(),
            Period: "thisMonth"
        );

        var thisYearRides = allRides.Where(r =>
            GetRideDate(r.RideDateTimeLocal) >= firstOfYear
            && GetRideDate(r.RideDateTimeLocal) <= today
        );

        var thisYearSummary = new MileageSummary(
            Miles: thisYearRides.Sum(r => r.Miles),
            RideCount: thisYearRides.Count(),
            Period: "thisYear"
        );

        var allTimeSummary = new MileageSummary(
            Miles: allRides.Sum(r => r.Miles),
            RideCount: allRides.Count,
            Period: "allTime"
        );

        // Filter rides for pagination if date range provided
        var filteredRides = allRides
            .Where(r =>
            {
                var rideDate = GetRideDate(r.RideDateTimeLocal);
                if (fromDate.HasValue && rideDate < fromDate)
                    return false;
                if (toDate.HasValue && rideDate > toDate)
                    return false;
                return true;
            })
            .ToList();

        // Calculate filtered total
        var filteredTotalSummary = new MileageSummary(
            Miles: filteredRides.Sum(r => r.Miles),
            RideCount: filteredRides.Count,
            Period: "filtered"
        );

        // Apply pagination
        var totalRows = filteredRides.Count;
        var paginatedRides = filteredRides
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RideHistoryRow(
                RideId: r.Id,
                RideDateTimeLocal: r.RideDateTimeLocal,
                Miles: r.Miles,
                RideMinutes: r.RideMinutes,
                Temperature: r.Temperature,
                GasPricePerGallon: r.GasPricePerGallon,
                WindSpeedMph: r.WindSpeedMph,
                WindDirectionDeg: r.WindDirectionDeg,
                RelativeHumidityPercent: r.RelativeHumidityPercent,
                CloudCoverPercent: r.CloudCoverPercent,
                PrecipitationType: r.PrecipitationType,
                Note: r.Notes
            ))
            .ToList();

        // Construct response
        return new RideHistoryResponse(
            Summaries: new RideHistorySummaries(
                ThisMonth: thisMonthSummary,
                ThisYear: thisYearSummary,
                AllTime: allTimeSummary
            ),
            FilteredTotal: filteredTotalSummary,
            Rides: paginatedRides,
            Page: page,
            PageSize: pageSize,
            TotalRows: totalRows
        );
    }
}
