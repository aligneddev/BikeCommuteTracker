using BikeTracking.Domain.FSharp;
using Microsoft.FSharp.Collections;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class MonthlySummaryDistributorTests
{
    // --- getWeekdays (T010) ---

    [Fact]
    public void GetWeekdays_StandardMonth_ReturnsOnlyMondayThroughFridaySortedAscending()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025).ToList();

        Assert.NotEmpty(weekdays);
        Assert.All(
            weekdays,
            date => Assert.True(date.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday)
        );
        Assert.Equal(weekdays.OrderBy(date => date).ToList(), weekdays);
    }

    [Fact]
    public void GetWeekdays_FebruaryNonLeapYear_ReturnsTwentyWeekdays()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(2, 2025).ToList();

        Assert.Equal(20, weekdays.Count);
    }

    [Fact]
    public void GetWeekdays_FebruaryLeapYear_ReturnsCorrectWeekdayCount()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(2, 2024).ToList();

        Assert.Equal(21, weekdays.Count);
    }

    [Fact]
    public void GetWeekdays_AnyMonth_ContainsNoSaturdaysOrSundays()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025).ToList();

        Assert.DoesNotContain(weekdays, date => date.DayOfWeek == DayOfWeek.Saturday);
        Assert.DoesNotContain(weekdays, date => date.DayOfWeek == DayOfWeek.Sunday);
    }

    // --- selectWeekdays (T011) ---

    [Fact]
    public void SelectWeekdays_WithOneDay_SelectsStrideThWeekday()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025);
        var weekdaysList = weekdays.ToList();

        var result = MonthlySummaryDistributor.selectWeekdays(weekdays, 1);

        Assert.True(result.IsOk);
        var selected = result.ResultValue.ToList();
        Assert.Single(selected);
        Assert.Equal(weekdaysList[^1], selected[0]);
    }

    [Fact]
    public void SelectWeekdays_WithDaysEqualToWeekdayCount_SelectsAllWeekdays()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025);
        var weekdaysList = weekdays.ToList();

        var result = MonthlySummaryDistributor.selectWeekdays(weekdays, weekdaysList.Count);

        Assert.True(result.IsOk);
        Assert.Equal(weekdaysList, result.ResultValue.ToList());
    }

    [Fact]
    public void SelectWeekdays_WithDaysGreaterThanWeekdayCount_ReturnsError()
    {
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025);
        var weekdaysList = weekdays.ToList();

        var result = MonthlySummaryDistributor.selectWeekdays(weekdays, weekdaysList.Count + 1);

        Assert.True(result.IsError);
    }

    [Fact]
    public void SelectWeekdays_May2025WithEightDays_SpreadsEvenlyNotFrontLoaded()
    {
        // May 2025 has 22 weekdays. stride = floor(22 / 8) = 2. First selected = weekdays[1] (0-indexed).
        var weekdays = MonthlySummaryDistributor.getWeekdays(5, 2025);
        var weekdaysList = weekdays.ToList();
        Assert.Equal(22, weekdaysList.Count);

        var result = MonthlySummaryDistributor.selectWeekdays(weekdays, 8);

        Assert.True(result.IsOk);
        var selected = result.ResultValue.ToList();
        Assert.Equal(8, selected.Count);
        Assert.Equal(weekdaysList[1], selected[0]);
    }

    // --- distributeRides (T012) ---

    [Fact]
    public void DistributeRides_PerDayMiles_UsesFlooredValueWithRemainderOnLastRide()
    {
        // 100 miles / 3 days => floor(33.333... * 100)/100 = 33.33 per day; remainder 0.01 on last ride.
        var result = MonthlySummaryDistributor.distributeRides(5, 2025, 100m, 3);

        Assert.True(result.IsOk);
        var rides = result.ResultValue.ToList();
        Assert.Equal(3, rides.Count);
        Assert.Equal(33.33m, rides[0].Item2);
        Assert.Equal(33.33m, rides[1].Item2);
        Assert.Equal(33.34m, rides[2].Item2);
    }

    [Fact]
    public void DistributeRides_SumOfAllMiles_EqualsTotalMilesExactlyWithNoFloatingPointLoss()
    {
        var result = MonthlySummaryDistributor.distributeRides(5, 2025, 100m, 3);

        Assert.True(result.IsOk);
        var sum = result.ResultValue.ToList().Sum(ride => ride.Item2);
        Assert.Equal(100m, sum);
    }

    [Fact]
    public void DistributeRides_AllGeneratedDates_AreWeekdays()
    {
        var result = MonthlySummaryDistributor.distributeRides(5, 2025, 96m, 8);

        Assert.True(result.IsOk);
        var rides = result.ResultValue.ToList();
        Assert.All(
            rides,
            ride => Assert.True(ride.Item1.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday)
        );
    }

    [Fact]
    public void DistributeRides_May2025EightDaysNinetySixMiles_ProducesEightRidesSummingToNinetySix()
    {
        var result = MonthlySummaryDistributor.distributeRides(5, 2025, 96m, 8);

        Assert.True(result.IsOk);
        var rides = result.ResultValue.ToList();
        Assert.Equal(8, rides.Count);
        Assert.Equal(96.00m, rides.Sum(ride => ride.Item2));
    }
}
