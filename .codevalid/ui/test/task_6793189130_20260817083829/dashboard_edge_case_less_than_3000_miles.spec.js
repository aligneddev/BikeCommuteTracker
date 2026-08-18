import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard shows zero oil-change savings when mileage is below 3000", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_edge_case_less_than_3000_miles",
    testTitle: testInfo.title,
  });

  await recorder.step("mock dashboard data below oil-change interval threshold", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardPage(page, {
      totals: {
        allTimeMiles: { miles: 2000, rideCount: 3, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 150,
          oilChangeSavings: 0,
          netExpenses: 150,
          oilChangeIntervalCount: 0,
        },
      },
    });
  });

  await recorder.step("open dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
  });

  await recorder.step("verify zero savings and unchanged net expenses", async () => {
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$150.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$0.00");
    await expect(
      page.locator(".expense-summary-card-row-net-expense")
    ).toContainText("$150.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_edge_case_less_than_3000_miles");
  await recorder.save(testInfo);
});
