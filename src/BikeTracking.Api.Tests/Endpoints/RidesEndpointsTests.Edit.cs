using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed partial class RidesEndpointsTests
{
    [Fact]
    public async Task PutEditRide_WithValidRequest_Returns200AndUpdatedVersion()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Jules");
        var rideId = await host.RecordRideAsync(
            userId,
            miles: 8.5m,
            rideMinutes: 30,
            temperature: 65m
        );

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now.AddMinutes(-10),
            Miles: 11.25m,
            RideMinutes: 42,
            Temperature: 68m,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<EditRideResponse>();
        Assert.NotNull(payload);
        Assert.Equal(rideId, payload.RideId);
        Assert.Equal(2, payload.NewVersion);
    }

    [Fact]
    public async Task PutEditRide_WithGasPrice_StoresGasPrice()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceEdit");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m, gasPricePerGallon: 3.0000m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.25m,
            RideMinutes: 39,
            Temperature: 68m,
            ExpectedVersion: 1,
            GasPricePerGallon: 3.5555m
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == rideId);
        Assert.Equal(3.5555m, ride.GasPricePerGallon);
    }

    [Fact]
    public async Task PutEditRide_WithNullGasPrice_StoresNull()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("GasPriceEditNull");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m, gasPricePerGallon: 3.0000m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 9.25m,
            RideMinutes: 33,
            Temperature: 68m,
            ExpectedVersion: 1,
            GasPricePerGallon: null
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = host.App.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
        var ride = await dbContext.Rides.SingleAsync(r => r.Id == rideId);
        Assert.Null(ride.GasPricePerGallon);
    }

    [Fact]
    public async Task PutEditRide_WithInvalidPayload_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Luca");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 0m,
            RideMinutes: null,
            Temperature: null,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_WithMilesAboveMaximum_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Liam");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 250m,
            RideMinutes: null,
            Temperature: null,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_ForDifferentRiderRide_Returns403()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var ownerId = await host.SeedUserAsync("Mira");
        var otherUserId = await host.SeedUserAsync("Noah");
        var rideId = await host.RecordRideAsync(ownerId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.2m,
            RideMinutes: 39,
            Temperature: 67m,
            ExpectedVersion: 1
        );

        var response = await host.Client.PutWithAuthAsync(
            $"/api/rides/{rideId}",
            request,
            otherUserId
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_WithStaleExpectedVersion_Returns409()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Omar");
        var rideId = await host.RecordRideAsync(userId, miles: 8.5m);

        var request = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.2m,
            RideMinutes: 39,
            Temperature: 67m,
            ExpectedVersion: 99
        );

        var response = await host.Client.PutWithAuthAsync($"/api/rides/{rideId}", request, userId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task PutEditRide_ThenGetHistory_ReturnsEditedMilesInRowsAndTotals()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("Pia");
        var rideId = await host.RecordRideAsync(
            userId,
            miles: 6.0m,
            rideMinutes: 31,
            temperature: 64m
        );

        var editRequest = new EditRideRequest(
            RideDateTimeLocal: DateTime.Now,
            Miles: 10.25m,
            RideMinutes: 35,
            Temperature: 67m,
            ExpectedVersion: 1
        );

        var editResponse = await host.Client.PutWithAuthAsync(
            $"/api/rides/{rideId}",
            editRequest,
            userId
        );
        Assert.Equal(HttpStatusCode.OK, editResponse.StatusCode);

        var historyResponse = await host.Client.GetWithAuthAsync("/api/rides/history", userId);
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);

        var payload = await historyResponse.Content.ReadFromJsonAsync<RideHistoryResponse>();
        Assert.NotNull(payload);

        var editedRide = Assert.Single(payload.Rides, r => r.RideId == rideId);
        Assert.Equal(10.25m, editedRide.Miles);
        Assert.Equal(10.25m, payload.FilteredTotal.Miles);
        Assert.Equal(10.25m, payload.Summaries.AllTime.Miles);
    }
}
