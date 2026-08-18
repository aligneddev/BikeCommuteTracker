import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAdvancedDashboardScenario,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("advanced_dashboard_difficulty_derived_from_wind", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "advanced_dashboard_difficulty_derived_from_wind",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated app session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("mock difficulty analytics with derived average", async () => {
    await setupAdvancedDashboardScenario(page, {
      response: {
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 0,
            totalMiles: 0,
            gallonsSaved: null,
            fuelCostAvoided: null,
            fuelCostEstimated: false,
            mileageRateSavings: null,
            combinedSavings: null,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: null,
          },
          monthly: {
            period: "monthly",
            rideCount: 0,
            totalMiles: 0,
            gallonsSaved: null,
            fuelCostAvoided: null,
            fuelCostEstimated: false,
            mileageRateSavings: null,
            combinedSavings: null,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: null,
          },
          yearly: {
            period: "yearly",
            rideCount: 0,
            totalMiles: 0,
            gallonsSaved: null,
            fuelCostAvoided: null,
            fuelCostEstimated: false,
            mileageRateSavings: null,
            combinedSavings: null,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: null,
          },
          allTime: {
            period: "allTime",
            rideCount: 0,
            totalMiles: 0,
            gallonsSaved: null,
            fuelCostAvoided: null,
            fuelCostEstimated: false,
            mileageRateSavings: null,
            combinedSavings: null,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: null,
          },
        },
        suggestions: [],
        reminders: {
          mpgReminderRequired: false,
          mileageRateReminderRequired: false,
        },
        generatedAtUtc: "2026-08-17T08:00:00.000Z",
        difficultySection: {
          overallAverageDifficulty: 3.2,
          difficultyByMonth: [
            { monthNumber: 1, monthName: "January", averageDifficulty: 3.2, rideCount: 5 }
          ],
          mostDifficultMonths: [
            { monthNumber: 1, monthName: "January", averageDifficulty: 3.2, rideCount: 5 }
          ],
          windResistanceDistribution: [
            { rating: -4, rideCount: 1, label: "-4", isAssisted: true },
            { rating: 0, rideCount: 1, label: "0", isAssisted: false },
            { rating: 4, rideCount: 1, label: "+4", isAssisted: false }
          ],
          isEmpty: false,
        },
      },
    });
  });

  await recorder.step("load advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert overall average difficulty is shown", async () => {
    await expect(page.getByRole("heading", { name: "Ride Difficulty" })).toBeVisible();
    await expect(page.getByText("3.2")).toBeVisible();
    await expect(page.getByText(/\/ 5 overall average/)).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_difficulty_derived_from_wind");
  await recorder.save(testInfo);
});
