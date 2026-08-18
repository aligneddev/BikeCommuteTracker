import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Oil-change savings marked 'Unavailable' when price is not configured", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_oil_price_unset_savings_unavailable",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare dashboard response with unset oil price", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        allTimeMiles: { miles: 9000, rideCount: 10, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 50,
          oilChangeSavings: null,
          netExpenses: 50,
          oilChangeIntervalCount: 0,
        },
      },
    });
  });

  await recorder.step("open dashboard page", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("verify savings placeholder and positive net expenses", async () => {
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$50.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("—");
    await expect(
      page.locator(".expense-summary-card-row-net-expense")
    ).toContainText("$50.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_oil_price_unset_savings_unavailable");
  await recorder.save(testInfo);
});
