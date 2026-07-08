using System.Net;
using System.Net.Http.Json;
using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Tests.Endpoints;

public sealed partial class RidesEndpointsTests
{
    [Fact]
    public async Task RidePresetCrud_FullRoundTrip_IncludingExactTimeAndDelete()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("PresetCrud");

        var createRequest = new UpsertRidePresetRequest(
            Name: "Morning Commute",
            PrimaryDirection: "SW",
            PeriodTag: "morning",
            ExactStartTimeLocal: "07:45",
            DurationMinutes: 34,
            Miles: 7.2m
        );

        var createResponse = await host.Client.PostWithAuthAsync(
            "/api/rides/presets",
            createRequest,
            userId
        );

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<RidePresetDto>();
        Assert.NotNull(created);
        Assert.Equal("07:45", created.ExactStartTimeLocal);
        Assert.Equal(7.2m, created.Miles);

        var listResponse = await host.Client.GetWithAuthAsync("/api/rides/presets", userId);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<RidePresetsResponse>();
        Assert.NotNull(listed);
        var existing = Assert.Single(listed.Presets);
        Assert.Equal(created.PresetId, existing.PresetId);

        var updateRequest = new UpsertRidePresetRequest(
            Name: "Morning Commute",
            PrimaryDirection: "NE",
            PeriodTag: "morning",
            ExactStartTimeLocal: "08:05",
            DurationMinutes: 40,
            Miles: 8.1m
        );

        var updateResponse = await host.Client.PutWithAuthAsync(
            $"/api/rides/presets/{created.PresetId}",
            updateRequest,
            userId
        );

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<RidePresetDto>();
        Assert.NotNull(updated);
        Assert.Equal("08:05", updated.ExactStartTimeLocal);
        Assert.Equal("NE", updated.PrimaryDirection);
        Assert.Equal(8.1m, updated.Miles);

        var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/rides/presets/{created.PresetId}"
        );
        deleteRequest.Headers.Add("X-User-Id", userId.ToString());
        var deleteResponse = await host.Client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task CreateRidePreset_DuplicateNameForSameRider_Returns400()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("PresetDuplicate");

        var request = new UpsertRidePresetRequest(
            Name: "Afternoon Return",
            PrimaryDirection: "NE",
            PeriodTag: "afternoon",
            ExactStartTimeLocal: "17:35",
            DurationMinutes: 32,
            Miles: 6.8m
        );

        var first = await host.Client.PostWithAuthAsync("/api/rides/presets", request, userId);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await host.Client.PostWithAuthAsync("/api/rides/presets", request, userId);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    [Fact]
    public async Task CreateRidePreset_MorningWithOverrideDirection_PersistsOverrideNotDefault()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("PresetDirectionOverride");

        // Morning default would be SW, but rider overrides to North
        var request = new UpsertRidePresetRequest(
            Name: "Custom Morning",
            PrimaryDirection: "North",
            PeriodTag: "morning",
            ExactStartTimeLocal: "07:30",
            DurationMinutes: 35,
            Miles: 9.3m
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides/presets", request, userId);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<RidePresetDto>();
        Assert.NotNull(created);
        Assert.Equal("North", created.PrimaryDirection);
        Assert.Equal("morning", created.PeriodTag);
        Assert.Equal(9.3m, created.Miles);
    }

    [Fact]
    public async Task CreateRidePreset_AfternoonWithOverrideDirection_PersistsOverrideNotDefault()
    {
        await using var host = await RecordRideApiHost.StartAsync();
        var userId = await host.SeedUserAsync("PresetDirectionOverrideAft");

        // Afternoon default would be NE, but rider overrides to South
        var request = new UpsertRidePresetRequest(
            Name: "Custom Afternoon",
            PrimaryDirection: "South",
            PeriodTag: "afternoon",
            ExactStartTimeLocal: "17:15",
            DurationMinutes: 30,
            Miles: 8.7m
        );

        var response = await host.Client.PostWithAuthAsync("/api/rides/presets", request, userId);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<RidePresetDto>();
        Assert.NotNull(created);
        Assert.Equal("South", created.PrimaryDirection);
        Assert.Equal("afternoon", created.PeriodTag);
        Assert.Equal(8.7m, created.Miles);
    }
}
