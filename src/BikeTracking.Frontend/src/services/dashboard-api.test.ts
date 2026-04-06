import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("dashboard-api", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests GET /api/dashboard and returns dashboard data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          totals: {
            currentMonthMiles: { miles: 10, rideCount: 1, period: "thisMonth" },
            yearToDateMiles: { miles: 45, rideCount: 4, period: "thisYear" },
            allTimeMiles: { miles: 120, rideCount: 12, period: "allTime" },
            moneySaved: {
              mileageRateSavings: 15,
              fuelCostAvoided: 7,
              combinedSavings: 22,
              qualifiedRideCount: 3,
            },
          },
          averages: {
            averageTemperature: 61,
            averageMilesPerRide: 10,
            averageRideMinutes: 27,
          },
          charts: { mileageByMonth: [], savingsByMonth: [] },
          suggestions: [],
          missingData: {
            ridesMissingSavingsSnapshot: 0,
            ridesMissingGasPrice: 0,
            ridesMissingTemperature: 0,
            ridesMissingDuration: 0,
          },
          generatedAtUtc: new Date().toISOString(),
        },
        true,
      ),
    );

    const module = await import("./dashboard-api");
    const result = await module.getDashboard();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.totals.allTimeMiles.miles).toBe(120);
  });
});
