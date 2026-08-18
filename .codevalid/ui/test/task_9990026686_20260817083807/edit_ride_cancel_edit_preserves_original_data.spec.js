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
  let putCalled = false;
  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, historyResponse));
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, { date: "2024-06-15", pricePerGallon: null, isAvailable: false, dataSource: null }));
  await page.route(/.*\/api\/rides\/101$/, async (route) => {
    if (route.request().method() === "PUT") {
      putCalled = true;
      return json(route, 200, { rideId: 101, newVersion: 2, message: "Ride updated." });
    }
    return route.fallback();
  });
  return { wasPutCalled: () => putCalled };
}

test("edit_ride_cancel_edit_preserves_original_data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_cancel_edit_preserves_original_data", testTitle: testInfo.title });
  let api;

  await recorder.step("setup authenticated history scenario", async () => {
    await setupAuthenticatedSession(page);
    api = await setupScenario(page);
  });

  await recorder.step("open edit mode and change values", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-miles-101").fill("15.0");
    await page.locator("#edit-ride-note-101").fill("Great ride");
  });

  await recorder.step("cancel edit and verify original values remain", async () => {
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("#edit-ride-miles-101")).toHaveCount(0);
    await expect(page.getByText("10.2 mi")).toBeVisible();
    await page.getByRole("button", { name: "View ride note" }).click();
    await expect(page.getByRole("tooltip")).toContainText("Good ride");
    await expect(api.wasPutCalled()).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_cancel_edit_preserves_original_data");
  await recorder.save(testInfo);
});
