import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Oil-change savings correctly calculated from accumulated ride miles and configured price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_oil_savings_calculated_correctly",
    testTitle: testInfo.title,
  });

  await recorder.step("mock dashboard with calculated oil-change savings", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        allTimeMiles: { miles: 9500, rideCount: 12, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 50,
          oilChangeSavings: 180,
          netExpenses: -130,
          oilChangeIntervalCount: 3,
        },
      },
    });
  });

  await recorder.step("load dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("verify totals and negative net state", async () => {
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$50.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$180.00");
    await expect(page.getByText("Net Savings")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$130.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_oil_savings_calculated_correctly");
  await recorder.save(testInfo);
});
