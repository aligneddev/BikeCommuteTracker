import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard correctly handles edge case of exactly 3000-mile intervals for oil-change savings", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_edge_case_exact_interval",
    testTitle: testInfo.title,
  });

  await recorder.step("mock exact interval dashboard data", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        allTimeMiles: { miles: 3000, rideCount: 4, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 100,
          oilChangeSavings: 50,
          netExpenses: 50,
          oilChangeIntervalCount: 1,
        },
      },
    });
  });

  await recorder.step("load dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("assert interval savings and net expense", async () => {
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$100.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$50.00");
    await expect(
      page.locator(".expense-summary-card-row-net-expense")
    ).toContainText("$50.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_edge_case_exact_interval");
  await recorder.save(testInfo);
});
