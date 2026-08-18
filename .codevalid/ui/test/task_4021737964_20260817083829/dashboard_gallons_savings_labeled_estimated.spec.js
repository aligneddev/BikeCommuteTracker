import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_gallons_savings_labeled_estimated", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_gallons_savings_labeled_estimated", testInfo.title);

  await recorder.step("Seed authenticated session with estimated fuel-cost window", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 2,
            totalMiles: 20,
            gallonsSaved: 0.8,
            fuelCostAvoided: 75.8,
            fuelCostEstimated: true,
            mileageRateSavings: 30,
            combinedSavings: 105.8,
            totalExpenses: 0,
            oilChangeSavings: null,
            netSavings: 75.8,
          },
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert estimated label is shown next to fuel-cost avoided", async () => {
    await expect(page.getByRole("heading", { name: "Deep-dive into your savings." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
    await expect(page.getByText("$75.80")).toBeVisible();
    await expect(page.getByText("Est.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_gallons_savings_labeled_estimated");
  await recorder.save(testInfo);
});
