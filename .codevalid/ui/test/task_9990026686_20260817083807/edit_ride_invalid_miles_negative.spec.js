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
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 10.2, rideMinutes: 35, note: "Good ride" }],
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

test("edit_ride_invalid_miles_negative", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_invalid_miles_negative", testTitle: testInfo.title });

  await recorder.step("setup authenticated history scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupScenario(page);
  });

  await recorder.step("open edit mode and enter negative miles", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-miles-101").fill("-5");
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("verify validation and preserved values", async () => {
    await expect(page.getByRole("alert")).toContainText("Miles must be greater than 0");
    await expect(page.locator("#edit-ride-miles-101")).toHaveValue("-5");
    await expect(page.locator("#edit-ride-note-101")).toHaveValue("Good ride");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_invalid_miles_negative");
  await recorder.save(testInfo);
});
