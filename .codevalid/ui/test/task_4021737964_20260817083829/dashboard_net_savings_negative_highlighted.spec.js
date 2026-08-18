import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_net_savings_negative_highlighted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_net_savings_negative_highlighted", testInfo.title);

  await recorder.step("Seed advanced dashboard with negative net savings", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        savingsWindows: {
          weekly: {
            period: "weekly",
            rideCount: 1,
            totalMiles: 12,
            gallonsSaved: 0.4,
            fuelCostAvoided: 40,
            fuelCostEstimated: false,
            mileageRateSavings: 20,
            combinedSavings: 60,
            totalExpenses: 150,
            oilChangeSavings: 0,
            netSavings: -50,
          },
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert negative net savings value and negative styling class", async () => {
    const negativeCell = page.locator(".savings-windows-negative").first();
    await expect(negativeCell).toBeVisible();
    await expect(negativeCell).toContainText("-$50.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_net_savings_negative_highlighted");
  await recorder.save(testInfo);
});
