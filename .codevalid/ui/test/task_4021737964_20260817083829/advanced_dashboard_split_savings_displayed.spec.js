import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_split_savings_displayed", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_split_savings_displayed",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock main dashboard split savings response", async () => {
    await setupDashboardScenario(page, {
      response: {
        totals: {
          currentMonthMiles: { miles: 42.0, rideCount: 3, period: "thisMonth" },
          yearToDateMiles: { miles: 180.0, rideCount: 10, period: "thisYear" },
          allTimeMiles: { miles: 260.0, rideCount: 16, period: "allTime" },
          moneySaved: {
            mileageRateSavings: 42.5,
            fuelCostAvoided: 18.75,
            qualifiedRideCount: 8,
          },
          expenseSummary: {
            totalManualExpenses: 0,
            oilChangeSavings: null,
            netExpenses: null,
            oilChangeIntervalCount: 0,
          },
        },
        averages: {
          averageTemperature: 64.4,
          averageMilesPerRide: 11.3,
          averageRideMinutes: 31.2,
        },
        charts: {
          mileageByMonth: [],
          savingsByMonth: [],
        },
        suggestions: [],
        missingData: {
          ridesMissingSavingsSnapshot: 0,
          ridesMissingGasPrice: 0,
          ridesMissingTemperature: 0,
          ridesMissingDuration: 0,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
      },
    });
  });

  await recorder.step("load main dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("assert split savings render as separate values", async () => {
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Mileage rate savings $42.50")).toBeVisible();
    await expect(page.getByText("Gallons-based savings $18.75")).toBeVisible();
    await expect(page.getByText("$42.50")).toBeVisible();
    await expect(page.getByText("Total Savings")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_split_savings_displayed");
  await recorder.save(testInfo);
});
