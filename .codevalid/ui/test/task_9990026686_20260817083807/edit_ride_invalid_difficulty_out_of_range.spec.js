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
  rides: [{ rideId: 101, rideDateTimeLocal: "2024-06-15T07:30:00", miles: 10.2, rideMinutes: 35, difficulty: 4 }],
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
    return json(route, 400, { code: "VALIDATION_ERROR", message: "Difficulty must be an integer between 1 and 5." });
  });
  return { getCapturedRequest: () => capturedRequest };
}

test("edit_ride_invalid_difficulty_out_of_range", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({ testId: "edit_ride_invalid_difficulty_out_of_range", testTitle: testInfo.title });
  let api;

  await recorder.step("setup authenticated history scenario", async () => {
    await setupAuthenticatedSession(page);
    api = await setupScenario(page);
  });

  await recorder.step("open edit mode and force invalid difficulty option", async () => {
    await page.goto("/rides/history");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-difficulty-101").evaluate((select) => {
      const option = document.createElement("option");
      option.value = "6";
      option.textContent = "6";
      select.appendChild(option);
      select.value = "6";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("verify server-side validation surfaced and other data preserved", async () => {
    await expect(page.getByRole("alert")).toContainText("Difficulty must be an integer between 1 and 5.");
    await expect(page.locator("#edit-ride-difficulty-101")).toHaveValue("6");
    await expect(api.getCapturedRequest().difficulty).toBe(6);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_invalid_difficulty_out_of_range");
  await recorder.save(testInfo);
});
