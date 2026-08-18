import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard shows zero net expense and unavailable oil savings with no expenses and unset oil price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_no_expenses_no_oil_price",
    testTitle: testInfo.title,
  });

  await recorder.step("setup authenticated session and dashboard mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        expenseSummary: {
          totalManualExpenses: 0,
          oilChangeSavings: null,
          netExpenses: null,
          oilChangeIntervalCount: 0,
        },
      },
    });
  });

  await recorder.step("load dashboard page", async () => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Your riding story, one screen." })
    ).toBeVisible();
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("verify zero manual expenses and unavailable oil savings state", async () => {
    await expect(page.getByText("Total Expenses")).toBeVisible();
    await expect(page.getByText("Oil Change Savings")).toBeVisible();
    await expect(page.getByText("Net Expenses")).toBeVisible();
    await expect(page.getByText("$0.00").first()).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("—");
    await expect(
      page.locator(".expense-summary-card-row-net-expense")
    ).toContainText("$0.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_no_expenses_no_oil_price");
  await recorder.save(testInfo);
});
