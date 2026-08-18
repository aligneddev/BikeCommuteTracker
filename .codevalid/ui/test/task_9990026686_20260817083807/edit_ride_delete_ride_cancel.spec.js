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
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 10.2, rideMinutes: 35 }],
  page: 1,
  pageSize: 25,
  totalRows: 1,
};

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setupScenario(page) {
  let deleteCalled = false;
  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, historyResponse));
  await page.route(/.*\/api\/rides\/101$/, async (route) => {
    if (route.request().method() === "DELETE") {
      deleteCalled = true;
      return json(route, 200, { rideId: 101, deletedAt: "2026-08-18T12:00:00Z", message: "Ride deleted." });
    }
    return route.fallback();
  });
  return { wasDeleteCalled: () => deleteCalled };
}

test("edit_ride_delete_ride_cancel", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_delete_ride_cancel", testTitle: testInfo.title });
  let api;

  await recorder.step("setup authenticated deletable history scenario", async () => {
    await setupAuthenticatedSession(page);
    api = await setupScenario(page);
  });

  await recorder.step("open delete dialog and cancel", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete Ride" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  await recorder.step("verify ride remains and no delete request sent", async () => {
    await expect(page.getByTestId("delete-dialog")).toHaveCount(0);
    await expect(page.getByText("10.2 mi")).toBeVisible();
    await expect(api.wasDeleteCalled()).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_delete_ride_cancel");
  await recorder.save(testInfo);
});
