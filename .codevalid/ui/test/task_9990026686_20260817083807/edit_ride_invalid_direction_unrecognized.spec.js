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
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 10.2, rideMinutes: 35, primaryTravelDirection: "NE" }],
  page: 1,
  pageSize: 25,
  totalRows: 1,
};

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setupScenario(page) {
  let capturedRequest = null;
  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, historyResponse));
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, { date: "2024-06-15", pricePerGallon: null, isAvailable: false, dataSource: null }));
  await page.route(/.*\/api\/rides\/101$/, async (route) => {
    capturedRequest = route.request().postDataJSON();
    return json(route, 400, { code: "VALIDATION_ERROR", message: "Direction must be one of: N, NE, E, SE, S, SW, W, NW or full names (North, Northeast, etc.)." });
  });
  return { getCapturedRequest: () => capturedRequest };
}

test("edit_ride_invalid_direction_unrecognized", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_invalid_direction_unrecognized", testTitle: testInfo.title });
  let api;

  await recorder.step("setup authenticated history scenario", async () => {
    await setupAuthenticatedSession(page);
    api = await setupScenario(page);
  });

  await recorder.step("open edit mode and force invalid direction value", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-direction-101").evaluate((select) => {
      const option = document.createElement("option");
      option.value = "Northwest";
      option.textContent = "Northwest";
      select.appendChild(option);
      select.value = "Northwest";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("verify direction validation surfaced", async () => {
    await expect(page.getByRole("alert")).toContainText("Direction must be one of: N, NE, E, SE, S, SW, W, NW or full names (North, Northeast, etc.).");
    await expect(page.locator("#edit-ride-direction-101")).toHaveValue("Northwest");
    await expect(api.getCapturedRequest().primaryTravelDirection).toBe("Northwest");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_invalid_direction_unrecognized");
  await recorder.save(testInfo);
});
