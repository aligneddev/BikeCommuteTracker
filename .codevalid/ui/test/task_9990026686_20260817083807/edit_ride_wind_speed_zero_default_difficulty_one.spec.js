import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

const historyResponse = {
  summaries: {
    thisMonth: { miles: 9, rideCount: 1, period: "thisMonth" },
    thisYear: { miles: 9, rideCount: 1, period: "thisYear" },
    allTime: { miles: 9, rideCount: 1, period: "allTime" },
  },
  filteredTotal: { miles: 9, rideCount: 1, period: "filtered" },
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 9, rideMinutes: 30, windSpeedMph: 0, windDirectionDeg: 180, difficulty: 4, primaryTravelDirection: "North" }],
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

test("edit_ride_wind_speed_zero_default_difficulty_one", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_wind_speed_zero_default_difficulty_one", testTitle: testInfo.title });

  await recorder.step("setup authenticated calm wind ride scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupScenario(page);
  });

  await recorder.step("open edit mode and trigger zero-wind suggestion", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-direction-101").selectOption("South");
    await expect(page.locator("#edit-ride-difficulty-101")).toHaveValue("1");
  });

  await recorder.step("change direction again and ensure suggestion remains one", async () => {
    await page.locator("#edit-ride-direction-101").selectOption("NE");
    await expect(page.locator("#edit-ride-difficulty-101")).toHaveValue("1");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_wind_speed_zero_default_difficulty_one");
  await recorder.save(testInfo);
});
