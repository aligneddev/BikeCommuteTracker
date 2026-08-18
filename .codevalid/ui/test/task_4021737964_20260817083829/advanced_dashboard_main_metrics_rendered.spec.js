import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_main_metrics_rendered", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_main_metrics_rendered",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock advanced dashboard data with monthly yearly and all-time miles", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 1,
            totalMiles: 12.3,
            gallonsSaved: 0.5,
            fuelCostAvoided: 2.1,
            fuelCostEstimated: false,
            mileageRateSavings: 6.15,
            combinedSavings: 8.25,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 8.25,
          },
          monthly: {
            period: "monthly",
            rideCount: 4,
            totalMiles: 50.5,
            gallonsSaved: 2.0,
            fuelCostAvoided: 8.4,
            fuelCostEstimated: false,
            mileageRateSavings: 25.25,
            combinedSavings: 33.65,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 33.65,
          },
          yearly: {
            period: "yearly",
            rideCount: 12,
            totalMiles: 210.7,
            gallonsSaved: 8.4,
            fuelCostAvoided: 35.11,
            fuelCostEstimated: false,
            mileageRateSavings: 105.35,
            combinedSavings: 140.46,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 140.46,
          },
          allTime: {
            period: "allTime",
            rideCount: 24,
            totalMiles: 450.9,
            gallonsSaved: 18.0,
            fuelCostAvoided: 75.15,
            fuelCostEstimated: false,
            mileageRateSavings: 225.45,
            combinedSavings: 300.6,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 300.6,
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

  await recorder.step("assert advanced dashboard headings and rendered mileage values", async () => {
    await expect(page.getByRole("heading", { name: "Deep-dive into your savings." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
    await expect(page.getByText("This Month")).toBeVisible();
    await expect(page.getByText("This Year")).toBeVisible();
    await expect(page.getByText("All Time")).toBeVisible();
    await expect(page.getByText("50.5 mi")).toBeVisible();
    await expect(page.getByText("210.7 mi")).toBeVisible();
    await expect(page.getByText("450.9 mi")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_main_metrics_rendered");
  await recorder.save(testInfo);
});
