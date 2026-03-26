import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import * as ridesService from "./ridesService";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok: boolean): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 400,
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
      jsonResponse({ message: "Validation failed" }, false),
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
});
