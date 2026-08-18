import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard correctly sums multiple manual expenses with unset oil price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_manual_expenses_only",
    testTitle: testInfo.title,
  });

  await recorder.step("setup dashboard response with manual expenses only", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        expenseSummary: {
          totalManualExpenses: 49.25,
          oilChangeSavings: null,
          netExpenses: 49.25,
          oilChangeIntervalCount: 0,
        },
      },
    });
  });

  await recorder.step("open dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("assert manual expenses and net expense totals", async () => {
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$49.25");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("—");
    await expect(
      page.locator(".expense-summary-card-row-net-expense")
    ).toContainText("$49.25");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_manual_expenses_only");
  await recorder.save(testInfo);
});
