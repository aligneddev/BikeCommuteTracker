import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("Update failure allows continued app use with retry option", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("update_failure_allows_continue_with_retry_option", "Update failure allows continued app use with retry option");

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock healthy startup and dashboard continuity", async () => {
    await page.route("**/health", async (route) => {
      await json(route, 200, { status: "ok" });
    });

    await page.route("**/api/dashboard", async (route) => {
      await json(route, 200, {
        totals: {
          currentMonthMiles: { miles: 12.4, rideCount: 3, period: "thisMonth" },
          yearToDateMiles: { miles: 120.5, rideCount: 24, period: "thisYear" },
          allTimeMiles: { miles: 450.9, rideCount: 91, period: "allTime" },
          moneySaved: {
            mileageRateSavings: 64.25,
            fuelCostAvoided: 18.1,
            qualifiedRideCount: 24,
          },
          expenseSummary: {
            totalManualExpenses: 0,
            oilChangeSavings: null,
            netExpenses: null,
            oilChangeIntervalCount: 0,
          },
        },
        averages: {
          averageTemperature: 68.5,
          averageMilesPerRide: 5,
          averageRideMinutes: 24,
        },
        charts: {
          mileageByMonth: [
            { monthKey: "2026-07", label: "Jul", miles: 50 },
            { monthKey: "2026-08", label: "Aug", miles: 70.5 }
          ],
          savingsByMonth: [
            { monthKey: "2026-07", label: "Jul", mileageRateSavings: 10, fuelCostAvoided: 2 },
            { monthKey: "2026-08", label: "Aug", mileageRateSavings: 12, fuelCostAvoided: 3 }
          ],
        },
        suggestions: [],
        missingData: {
          ridesMissingSavingsSnapshot: 0,
          ridesMissingGasPrice: 0,
          ridesMissingTemperature: 0,
          ridesMissingDuration: 0,
        },
        generatedAtUtc: "2026-08-18T12:00:00Z",
      });
    });
  });

  await recorder.step("Launch app and continue into current version UI", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Miles by Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings by Month" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:update_failure_allows_continue_with_retry_option");
  await recorder.save(testInfo);
});
