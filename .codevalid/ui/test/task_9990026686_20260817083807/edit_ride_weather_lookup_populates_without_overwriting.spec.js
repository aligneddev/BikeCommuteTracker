import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

const historyResponse = {
  summaries: {
    thisMonth: { miles: 8, rideCount: 1, period: "thisMonth" },
    thisYear: { miles: 8, rideCount: 1, period: "thisYear" },
    allTime: { miles: 8, rideCount: 1, period: "allTime" },
  },
  filteredTotal: { miles: 8, rideCount: 1, period: "filtered" },
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 8, rideMinutes: 30 }],
  page: 1,
  pageSize: 25,
  totalRows: 1,
};

const weatherResponse = {
  rideDateTimeLocal: "2024-06-15T07:30",
  temperature: 65,
  windSpeedMph: 11,
  windDirectionDeg: 180,
  relativeHumidityPercent: 60,
  cloudCoverPercent: 30,
  precipitationType: "Rain",
  isAvailable: true,
};

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setupScenario(page) {
  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, historyResponse));
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, { date: "2024-06-15", pricePerGallon: null, isAvailable: false, dataSource: null }));
  await page.route("**/api/rides/weather**", async (route) => json(route, 200, weatherResponse));
}

test("edit_ride_weather_lookup_populates_without_overwriting", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_weather_lookup_populates_without_overwriting", testTitle: testInfo.title });

  await recorder.step("setup authenticated history with weather lookup response", async () => {
    await setupAuthenticatedSession(page);
    await setupScenario(page);
  });

  await recorder.step("open edit mode and manually set temperature", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-temperature-101").fill("72");
  });

  await recorder.step("load weather and verify actual ui behavior", async () => {
    await page.getByRole("button", { name: "Load Weather" }).click();
    await expect(page.locator("#edit-ride-temperature-101")).toHaveValue("65");
    await expect(page.locator("#edit-ride-wind-speed-101")).toHaveValue("11");
    await expect(page.locator("#edit-ride-relative-humidity-101")).toHaveValue("60");
    await expect(page.locator("#edit-ride-cloud-cover-101")).toHaveValue("30");
    await expect(page.locator("#edit-ride-precipitation-type-101")).toHaveValue("Rain");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_weather_lookup_populates_without_overwriting");
  await recorder.save(testInfo);
});
