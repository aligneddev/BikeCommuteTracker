import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

const historyResponse = {
  summaries: {
    thisMonth: { miles: 12, rideCount: 1, period: "thisMonth" },
    thisYear: { miles: 12, rideCount: 1, period: "thisYear" },
    allTime: { miles: 12, rideCount: 1, period: "allTime" },
  },
  filteredTotal: { miles: 12, rideCount: 1, period: "filtered" },
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 12, rideMinutes: 40, windSpeedMph: 15, windDirectionDeg: 270, difficulty: 4, primaryTravelDirection: "North", windResistanceRating: 1 }],
  page: 1,
  pageSize: 25,
  totalRows: 1,
};

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setupScenario(page) {
  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, historyResponse));
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, { date: "2024-06-15", pricePerGallon: null, isAvailable: false, dataSource: null }));
}

test("edit_ride_wind_resistance_recalculated_on_direction_change", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_wind_resistance_recalculated_on_direction_change", testTitle: testInfo.title });

  await recorder.step("setup authenticated windy ride scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupScenario(page);
  });

  await recorder.step("open edit mode and inspect initial difficulty", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#edit-ride-difficulty-101")).toHaveValue("4");
  });

  await recorder.step("change direction and verify current implementation suggestion", async () => {
    await page.locator("#edit-ride-direction-101").selectOption("South");
    await expect(page.locator("#edit-ride-difficulty-101")).toHaveValue("3");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_wind_resistance_recalculated_on_direction_change");
  await recorder.save(testInfo);
});
