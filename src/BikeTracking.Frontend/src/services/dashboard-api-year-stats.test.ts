import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok: boolean, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? status : status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dashboard-api year-stats", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests GET /api/dashboard/year-stats?year={year} and returns typed response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          year: 2025,
          hasDataForYear: true,
          mileageByMonth: [],
          savingsByMonth: [],
          difficulty: {
            hasData: false,
            overallAverageDifficulty: null,
            byMonth: [],
            mostDifficultMonths: [],
          },
          windResistance: { hasData: false, bins: [] },
        },
        true,
      ),
    );

    const module = await import("./dashboard-api");
    const result = await module.getYearStatsDashboard(2025);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/year-stats?year=2025"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.year).toBe(2025);
    expect(result.hasDataForYear).toBe(true);
  });

  it("throws when getYearStatsDashboard response is not OK", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 400));

    const module = await import("./dashboard-api");

    await expect(module.getYearStatsDashboard(1899)).rejects.toThrow();
  });

  it("requests GET /api/dashboard/year-stats/years and returns typed response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ years: [2025, 2024] }, true));

    const module = await import("./dashboard-api");
    const result = await module.getAvailableYears();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/year-stats/years"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.years).toEqual([2025, 2024]);
  });

  it("throws when getAvailableYears response is not OK", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));

    const module = await import("./dashboard-api");

    await expect(module.getAvailableYears()).rejects.toThrow();
  });
});
