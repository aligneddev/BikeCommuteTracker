import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

const historyResponse = {
  summaries: {
    thisMonth: { miles: 10.2, rideCount: 1, period: "thisMonth" },
    thisYear: { miles: 10.2, rideCount: 1, period: "thisYear" },
    allTime: { miles: 10.2, rideCount: 1, period: "allTime" },
  },
  filteredTotal: { miles: 10.2, rideCount: 1, period: "filtered" },
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-16T07:30:00", miles: 10.2, rideMinutes: 35, gasPricePerGallon: null }],
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
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, { date: "2024-06-16", pricePerGallon: 3.87, isAvailable: true, dataSource: "Last ride fallback" }));
}

test("edit_ride_gas_price_fallback_to_last_ride", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_gas_price_fallback_to_last_ride", testTitle: testInfo.title });

  await recorder.step("setup authenticated history scenario with fallback gas price", async () => {
    await setupAuthenticatedSession(page);
    await setupScenario(page);
  });

  await recorder.step("open edit mode and wait for fallback gas price", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#edit-ride-gas-price-101")).toHaveValue("3.87");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_gas_price_fallback_to_last_ride");
  await recorder.save(testInfo);
});
