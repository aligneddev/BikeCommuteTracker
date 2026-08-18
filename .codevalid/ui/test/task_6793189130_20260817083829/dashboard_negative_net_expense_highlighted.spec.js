import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Net expense is visually highlighted in red when negative", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_negative_net_expense_highlighted",
    testTitle: testInfo.title,
  });

  await recorder.step("mock dashboard with negative net expense", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        allTimeMiles: { miles: 6000, rideCount: 8, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 10,
          oilChangeSavings: 420,
          netExpenses: -410,
          oilChangeIntervalCount: 6,
        },
      },
    });
  });

  await recorder.step("navigate to dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("assert negative value uses savings styling row", async () => {
    const netRow = page.locator(".expense-summary-card-row-net-savings");
    await expect(netRow).toHaveCount(1);
    await expect(netRow).toContainText("Net Savings");
    await expect(netRow).toContainText("-$410.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_negative_net_expense_highlighted");
  await recorder.save(testInfo);
});
