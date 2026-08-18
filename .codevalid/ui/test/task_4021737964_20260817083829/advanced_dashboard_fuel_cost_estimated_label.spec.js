import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_fuel_cost_estimated_label", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_fuel_cost_estimated_label",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock advanced dashboard estimated fuel cost", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 1,
            totalMiles: 14.0,
            gallonsSaved: 0.75,
            fuelCostAvoided: 22.5,
            fuelCostEstimated: true,
            mileageRateSavings: 8.4,
            combinedSavings: 30.9,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 30.9,
          },
          monthly: {
            period: "monthly",
            rideCount: 1,
            totalMiles: 14.0,
            gallonsSaved: 0.75,
            fuelCostAvoided: 22.5,
            fuelCostEstimated: true,
            mileageRateSavings: 8.4,
            combinedSavings: 30.9,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 30.9,
          },
          yearly: {
            period: "yearly",
            rideCount: 1,
            totalMiles: 14.0,
            gallonsSaved: 0.75,
            fuelCostAvoided: 22.5,
            fuelCostEstimated: true,
            mileageRateSavings: 8.4,
            combinedSavings: 30.9,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 30.9,
          },
          allTime: {
            period: "allTime",
            rideCount: 1,
            totalMiles: 14.0,
            gallonsSaved: 0.75,
            fuelCostAvoided: 22.5,
            fuelCostEstimated: true,
            mileageRateSavings: 8.4,
            combinedSavings: 30.9,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 30.9,
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

  await recorder.step("assert estimated badge is shown next to fuel cost avoided", async () => {
    await expect(page.getByText("$22.50")).toBeVisible();
    await expect(page.getByText("Est.")).toBeVisible();
    await expect(page.locator('[title="Based on nearest known gas price"]').first()).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_fuel_cost_estimated_label");
  await recorder.save(testInfo);
});
