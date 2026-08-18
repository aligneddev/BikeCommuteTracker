import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_split_savings_displayed_separately", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_split_savings_displayed_separately", testInfo.title);

  await recorder.step("Seed authenticated session with split savings values", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        totals: {
          moneySaved: {
            mileageRateSavings: 120.5,
            fuelCostAvoided: 85.2,
            qualifiedRideCount: 4,
          },
        },
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert mileage-rate and gallons-based savings render as separate labels", async () => {
    await expect(page.getByText("Money Saved")).toBeVisible();
    await expect(page.getByText("Mileage rate savings $120.50")).toBeVisible();
    await expect(page.getByText("Gallons-based savings $85.20")).toBeVisible();
    await expect(page.getByText("Total Savings")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_split_savings_displayed_separately");
  await recorder.save(testInfo);
});
