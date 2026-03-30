import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import * as ridesService from "./ridesService";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(
  body: unknown,
  ok: boolean,
  status: number = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? status : status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ridesService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should send correct payload to POST /api/rides", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          rideId: 123,
          riderId: 1,
          savedAtUtc: new Date().toISOString(),
          eventStatus: "Queued",
        },
        true,
      ),
    );

    const request = {
      rideDateTimeLocal: new Date().toISOString(),
      miles: 10.5,
      rideMinutes: 45,
      temperature: 72,
    };

    await ridesService.recordRide(request);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rides"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    );
  });

  it("should return 201 response", async () => {
    const response = {
      rideId: 123,
      riderId: 1,
      savedAtUtc: new Date().toISOString(),
      eventStatus: "Queued",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    const request = {
      rideDateTimeLocal: new Date().toISOString(),
      miles: 10.5,
    };

    const result = await ridesService.recordRide(request);

    expect(result).toEqual(response);
    expect(result.rideId).toBe(123);
    expect(result.savedAtUtc).toBeDefined();
  });

  it("should throw on 400 response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Validation failed" }, false, 400),
    );

    const request = {
      rideDateTimeLocal: new Date().toISOString(),
      miles: -1,
    };

    await expect(ridesService.recordRide(request)).rejects.toThrow();
  });

  it("should return defaults from GET /api/rides/defaults", async () => {
    const response = {
      hasPreviousRide: true,
      defaultMiles: 10.5,
      defaultRideMinutes: 45,
      defaultTemperature: 72,
      defaultRideDateTimeLocal: new Date().toISOString(),
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    const result = await ridesService.getRideDefaults();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rides/defaults"),
      expect.any(Object),
    );
    expect(result).toEqual(response);
    expect(result.defaultMiles).toBe(10.5);
  });

  it("should return quick ride options from GET /api/rides/quick-options", async () => {
    const response = {
      options: [
        {
          miles: 10.5,
          rideMinutes: 45,
          lastUsedAtLocal: "2026-03-30T07:30:00",
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    const result = await ridesService.getQuickRideOptions();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rides/quick-options"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.options).toHaveLength(1);
    expect(result.options[0].miles).toBe(10.5);
  });

  it("should fetch ride history and return typed response", async () => {
    const response: ridesService.RideHistoryResponse = {
      summaries: {
        thisMonth: { miles: 12.5, rideCount: 2, period: "thisMonth" },
        thisYear: { miles: 68.4, rideCount: 9, period: "thisYear" },
        allTime: { miles: 140.2, rideCount: 20, period: "allTime" },
      },
      filteredTotal: { miles: 140.2, rideCount: 20, period: "filtered" },
      rides: [
        {
          rideId: 1,
          rideDateTimeLocal: "2026-03-20T10:30:00",
          miles: 12.5,
          rideMinutes: 35,
          temperature: 61,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    const result = await ridesService.getRideHistory();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rides/history"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(response);
  });

  it("should serialize from/to query parameters for ride history", async () => {
    const response: ridesService.RideHistoryResponse = {
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: "thisMonth" },
        thisYear: { miles: 0, rideCount: 0, period: "thisYear" },
        allTime: { miles: 0, rideCount: 0, period: "allTime" },
      },
      filteredTotal: { miles: 0, rideCount: 0, period: "filtered" },
      rides: [],
      page: 1,
      pageSize: 25,
      totalRows: 0,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    await ridesService.getRideHistory({
      from: "2026-03-01",
      to: "2026-03-31",
      page: 2,
      pageSize: 10,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("from=2026-03-01");
    expect(url).toContain("to=2026-03-31");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=10");
  });

  it("should provide thisYear and allTime summaries for dashboard usage", async () => {
    const response: ridesService.RideHistoryResponse = {
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: "thisMonth" },
        thisYear: { miles: 210.5, rideCount: 22, period: "thisYear" },
        allTime: { miles: 950.25, rideCount: 88, period: "allTime" },
      },
      filteredTotal: { miles: 950.25, rideCount: 88, period: "filtered" },
      rides: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(response, true));

    const result = await ridesService.getRideHistory({ page: 1, pageSize: 1 });

    expect(result.summaries.thisYear.miles).toBe(210.5);
    expect(result.summaries.allTime.miles).toBe(950.25);
  });

  it("should throw API error for invalid date range", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "INVALID_DATE_RANGE",
          message: "Invalid date range: from date must be <= to date",
        },
        false,
        400,
      ),
    );

    await expect(
      ridesService.getRideHistory({ from: "2026-03-31", to: "2026-03-01" }),
    ).rejects.toThrow(/date range/i);
  });

  it("should call DELETE /api/rides/{id} and return success payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          rideId: 123,
          deletedAt: "2026-03-30T14:22:15Z",
          message: "Ride deleted successfully.",
          isIdempotent: false,
        },
        true,
      ),
    );

    const result = await ridesService.deleteRide(123);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rides/123"),
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rideId).toBe(123);
      expect(result.value.message).toMatch(/deleted/i);
    }
  });

  it("should return structured error payload for delete failures", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "NOT_RIDE_OWNER",
          message: "You do not have permission to delete this ride.",
        },
        false,
        403,
      ),
    );

    const result = await ridesService.deleteRide(999);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_RIDE_OWNER");
      expect(result.error.message).toMatch(/permission/i);
    }
  });
});
