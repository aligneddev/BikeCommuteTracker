import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

test("advanced_dashboard_most_difficult_months_exactly_12", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_most_difficult_months_exactly_12",
    testTitle: testInfo.title,
  });

  const mostDifficultMonths = months.map((monthName, index) => ({
    monthNumber: index + 1,
    monthName,
    averageDifficulty: Number((5 - index * 0.2).toFixed(1)),
    rideCount: index < 3 ? 2 : 0,
  }));

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock advanced dashboard ranked 12-month difficulty list", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: { period: "weekly", rideCount: 0, totalMiles: 0, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          monthly: { period: "monthly", rideCount: 0, totalMiles: 0, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          yearly: { period: "yearly", rideCount: 0, totalMiles: 0, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
          allTime: { period: "allTime", rideCount: 0, totalMiles: 0, gallonsSaved: null, fuelCostAvoided: null, fuelCostEstimated: false, mileageRateSavings: null, combinedSavings: null, totalExpenses: 0, oilChangeSavings: null, netSavings: null },
        },
        suggestions: [],
        reminders: {
          mpgReminderRequired: false,
          mileageRateReminderRequired: false,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
        difficultySection: {
          overallAverageDifficulty: 3.4,
          difficultyByMonth: mostDifficultMonths,
          mostDifficultMonths,
          windResistanceDistribution: [],
          isEmpty: false,
        },
      },
    });
  });

  await recorder.step("load advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert ranked month list contains all 12 months", async () => {
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toBeVisible();
    const items = page.locator(".difficulty-month-ranking .difficulty-month-row");
    await expect(items).toHaveCount(12);
    for (const month of months) {
      await expect(page.getByText(month, { exact: true })).toBeVisible();
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_most_difficult_months_exactly_12");
  await recorder.save(testInfo);
});
