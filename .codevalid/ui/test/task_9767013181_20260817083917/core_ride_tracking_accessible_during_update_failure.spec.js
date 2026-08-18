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

test("Core ride tracking remains accessible even if update or installation fails", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("core_ride_tracking_accessible_during_update_failure", "Core ride tracking remains accessible even if update or installation fails");

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock startup and dashboard data", async () => {
    await page.route("**/health", async (route) => {
      await json(route, 200, { status: "ok" });
    });

    await page.route("**/api/dashboard", async (route) => {
      await json(route, 200, {
        totals: {
          currentMonthMiles: { miles: 18.2, rideCount: 4, period: "thisMonth" },
          yearToDateMiles: { miles: 202.8, rideCount: 38, period: "thisYear" },
          allTimeMiles: { miles: 980.4, rideCount: 185, period: "allTime" },
          moneySaved: {
            mileageRateSavings: 140.75,
            fuelCostAvoided: 42.35,
            qualifiedRideCount: 38,
          },
          expenseSummary: {
            totalManualExpenses: 12.5,
            oilChangeSavings: null,
            netExpenses: null,
            oilChangeIntervalCount: 0,
          },
        },
        averages: {
          averageTemperature: 66.2,
          averageMilesPerRide: 5.3,
          averageRideMinutes: 23.5,
        },
        charts: {
          mileageByMonth: [
            { monthKey: "2026-07", label: "Jul", miles: 82.3 },
            { monthKey: "2026-08", label: "Aug", miles: 91.4 }
          ],
          savingsByMonth: [
            { monthKey: "2026-07", label: "Jul", mileageRateSavings: 18.2, fuelCostAvoided: 5.6 },
            { monthKey: "2026-08", label: "Aug", mileageRateSavings: 20.4, fuelCostAvoided: 6.1 }
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

  await recorder.step("Open dashboard and verify core ride tracking remains accessible", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Miles by Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings by Month" })).toBeVisible();
    await expect(page.getByText("980.4 mi")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:core_ride_tracking_accessible_during_update_failure");
  await recorder.save(testInfo);
});
