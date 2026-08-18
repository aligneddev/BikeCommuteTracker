import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_optional_metrics_hidden_by_default", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_optional_metrics_hidden_by_default",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock advanced dashboard suggestions without enabled optional metrics", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: { period: "weekly", rideCount: 1, totalMiles: 10, gallonsSaved: 0.4, fuelCostAvoided: 1.5, fuelCostEstimated: false, mileageRateSavings: 5, combinedSavings: 6.5, totalExpenses: 0, oilChangeSavings: null, netSavings: 6.5 },
          monthly: { period: "monthly", rideCount: 1, totalMiles: 10, gallonsSaved: 0.4, fuelCostAvoided: 1.5, fuelCostEstimated: false, mileageRateSavings: 5, combinedSavings: 6.5, totalExpenses: 0, oilChangeSavings: null, netSavings: 6.5 },
          yearly: { period: "yearly", rideCount: 1, totalMiles: 10, gallonsSaved: 0.4, fuelCostAvoided: 1.5, fuelCostEstimated: false, mileageRateSavings: 5, combinedSavings: 6.5, totalExpenses: 0, oilChangeSavings: null, netSavings: 6.5 },
          allTime: { period: "allTime", rideCount: 1, totalMiles: 10, gallonsSaved: 0.4, fuelCostAvoided: 1.5, fuelCostEstimated: false, mileageRateSavings: 5, combinedSavings: 6.5, totalExpenses: 0, oilChangeSavings: null, netSavings: 6.5 },
        },
        suggestions: [
          {
            suggestionKey: "consistency",
            title: "Enable expense summary",
            description: "Review additional expense insights when you are ready.",
            isEnabled: true,
          },
          {
            suggestionKey: "milestone",
            title: "Enable estimated gallons",
            description: "Show gallons saved once you approve this metric.",
            isEnabled: true,
          },
          {
            suggestionKey: "comeback",
            title: "Come back this week",
            description: "A short ride keeps your streak moving.",
            isEnabled: false,
          }
        ],
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

  await recorder.step("assert optional rows are not visible and suggestions section is shown", async () => {
    await expect(page.getByRole("heading", { name: "Suggestions" })).toBeVisible();
    await expect(page.getByText("Enable expense summary")).toBeVisible();
    await expect(page.getByText("Enable estimated gallons")).toBeVisible();
    await expect(page.getByText("Expense Summary")).toHaveCount(0);
    await expect(page.getByText("Estimated Gallons Avoided")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_optional_metrics_hidden_by_default");
  await recorder.save(testInfo);
});
