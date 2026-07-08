using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed partial class RidesEndpointsTests
{
    // History endpoint tests

    [Fact]
    public async Task GetRideHistory_WithRides_ReturnsSuccessResponse()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Georgia");

        // Record rides
        await host.RecordRideAsync(userId, miles: 10.5m);
        await host.RecordRideAsync(userId, miles: 5.2m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.NotNull(payload.Summaries);
        Assert.NotNull(payload.FilteredTotal);
        Assert.NotEmpty(payload.Rides);
        Assert.True(payload.Rides.Count >= 2);
        Assert.Equal(1, payload.Page);
        Assert.True(payload.TotalRows >= 2);
    }

    [Fact]
    public async Task GetRideHistory_WithDateRangeFilter_ReturnsFilteredRows()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Harper");

        await host.RecordRideAsync(userId, miles: 10m);
        await host.RecordRideAsync(userId, miles: 5m);

        var today = DateOnly.FromDateTime(DateTime.Now);
        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/rides/history?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"
        );
        request.Headers.Add("X-User-Id", userId.ToString());

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.TotalRows >= 1);
        Assert.True(payload.FilteredTotal.Miles > 0);
    }

    [Fact]
    public async Task GetRideHistory_WithoutRides_ReturnsEmptyWithZeroSummaries()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Henry");

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        Assert.Empty(payload.Rides);
        Assert.Equal(0, payload.TotalRows);
        Assert.Equal(0, payload.Summaries.AllTime.Miles);
        Assert.Equal(0, payload.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistory_WithoutAuth_Returns401()
    {
        await using var host = await RecordRideApiHost.StartAsync();

        var response = await host.Client.GetAsync("/api/rides/history");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetRideHistory_WithInvalidDateRange_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Ivy");

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/rides/history?from=2025-12-31&to=2025-01-01"
        );
        request.Headers.Add("X-User-Id", userId.ToString());
        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetRideHistory_ContainsGasPricePerGallon()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceHistory");
        var rideId = await host.RecordRideAsync(userId, miles: 6.0m, gasPricePerGallon: 3.4444m);

        var response = await host.Client.GetWithAuthAsync("/api/rides/history", userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);
        var ride = Assert.Single(payload.Rides, r => r.RideId == rideId);
        Assert.Equal(3.4444m, ride.GasPricePerGallon);
    }
}
