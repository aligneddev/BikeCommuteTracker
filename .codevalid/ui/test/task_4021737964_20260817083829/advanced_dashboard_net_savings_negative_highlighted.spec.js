import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_net_savings_negative_highlighted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_net_savings_negative_highlighted",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock advanced dashboard with negative net savings", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 2,
            totalMiles: 20.0,
            gallonsSaved: 1.0,
            fuelCostAvoided: 20.0,
            fuelCostEstimated: false,
            mileageRateSavings: 15.0,
            combinedSavings: 35.0,
            totalExpenses: 70.0,
            oilChangeSavings: 0,
            netSavings: -35.0,
          },
          monthly: {
            period: "monthly",
            rideCount: 2,
            totalMiles: 20.0,
            gallonsSaved: 1.0,
            fuelCostAvoided: 20.0,
            fuelCostEstimated: false,
            mileageRateSavings: 15.0,
            combinedSavings: 35.0,
            totalExpenses: 70.0,
            oilChangeSavings: 0,
            netSavings: -35.0,
          },
          yearly: {
            period: "yearly",
            rideCount: 2,
            totalMiles: 20.0,
            gallonsSaved: 1.0,
            fuelCostAvoided: 20.0,
            fuelCostEstimated: false,
            mileageRateSavings: 15.0,
            combinedSavings: 35.0,
            totalExpenses: 70.0,
            oilChangeSavings: 0,
            netSavings: -35.0,
          },
          allTime: {
            period: "allTime",
            rideCount: 2,
            totalMiles: 20.0,
            gallonsSaved: 1.0,
            fuelCostAvoided: 20.0,
            fuelCostEstimated: false,
            mileageRateSavings: 15.0,
            combinedSavings: 35.0,
            totalExpenses: 70.0,
            oilChangeSavings: 0,
            netSavings: -35.0,
          },
        },
        suggestions: [],
        reminders: {
          mpgReminderRequired: false,
          mileageRateReminderRequired: false,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
        difficultySection: null,
      },
    });
  });

  await recorder.step("load advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert negative net savings text and class", async () => {
    const negativeCell = page.locator(".savings-windows-net.savings-windows-negative").first();
    await expect(negativeCell).toBeVisible();
    await expect(negativeCell).toHaveText("-$35.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_net_savings_negative_highlighted");
  await recorder.save(testInfo);
});
