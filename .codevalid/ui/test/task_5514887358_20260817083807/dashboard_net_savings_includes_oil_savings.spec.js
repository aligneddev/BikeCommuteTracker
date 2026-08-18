import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardApis,
  buildAdvancedDashboardResponse,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Advanced dashboard calculates NetSavings including oil-change savings", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_net_savings_includes_oil_savings",
    testTitle: testInfo.title,
  });

  await recorder.step("seed advanced dashboard savings breakdown", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page, {
      advancedDashboard: buildAdvancedDashboardResponse({
        savingsWindows: {
          allTime: {
            period: "allTime",
            rideCount: 12,
            totalMiles: 9000,
            gallonsSaved: 20,
            fuelCostAvoided: 200,
            fuelCostEstimated: false,
            mileageRateSavings: 150,
            combinedSavings: 350,
            totalExpenses: 150,
            oilChangeSavings: 90,
            netSavings: 290,
          },
        },
      }),
    });
  });

  await recorder.step("open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("assert savings breakdown values", async () => {
    await expect(page.getByRole("heading", { name: "Deep-dive into your savings." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
    await expect(page.getByText("290", { exact: false })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_net_savings_includes_oil_savings");
  await recorder.save(testInfo);
});
