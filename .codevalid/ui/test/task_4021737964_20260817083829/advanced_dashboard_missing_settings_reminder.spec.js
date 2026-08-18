import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_missing_settings_reminder", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_missing_settings_reminder",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock reminder flags for missing settings", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: { period: "weekly", rideCount: 2, totalMiles: 20, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          monthly: { period: "monthly", rideCount: 2, totalMiles: 20, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          yearly: { period: "yearly", rideCount: 2, totalMiles: 20, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          allTime: { period: "allTime", rideCount: 2, totalMiles: 20, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
        },
        suggestions: [],
        reminders: {
          mpgReminderRequired: true,
          mileageRateReminderRequired: true,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
        difficultySection: null,
      },
    });
  });

  await recorder.step("load advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert reminder cards and settings links", async () => {
    await expect(page.getByTestId("mpg-reminder")).toBeVisible();
    await expect(page.getByText("Set your average car MPG")).toBeVisible();
    await expect(page.getByTestId("mileage-rate-reminder")).toBeVisible();
    await expect(page.getByText("Set your mileage rate")).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" }).first()).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_missing_settings_reminder");
  await recorder.save(testInfo);
});
