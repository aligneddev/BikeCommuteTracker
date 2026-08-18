import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_missing_wind_or_difficulty_empty_state", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_missing_wind_or_difficulty_empty_state",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock difficulty section empty state", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: { period: "weekly", rideCount: 1, totalMiles: 8, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          monthly: { period: "monthly", rideCount: 1, totalMiles: 8, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          yearly: { period: "yearly", rideCount: 1, totalMiles: 8, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          allTime: { period: "allTime", rideCount: 1, totalMiles: 8, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
        },
        suggestions: [],
        reminders: {
          mpgReminderRequired: false,
          mileageRateReminderRequired: false,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
        difficultySection: {
          overallAverageDifficulty: null,
          difficultyByMonth: [],
          mostDifficultMonths: [],
          windResistanceDistribution: [],
          isEmpty: true,
        },
      },
    });
  });

  await recorder.step("load advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert descriptive empty state is rendered", async () => {
    await expect(page.getByText("Record rides with travel direction to see difficulty trends.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Average Difficulty by Month" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_missing_wind_or_difficulty_empty_state");
  await recorder.save(testInfo);
});
