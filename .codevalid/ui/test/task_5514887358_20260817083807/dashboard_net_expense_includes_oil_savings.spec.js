import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardApis,
  buildDashboardResponse,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Dashboard NetExpense subtracts oil-change savings from total manual expenses", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_net_expense_includes_oil_savings",
    testTitle: testInfo.title,
  });

  await recorder.step("seed dashboard net expense values", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page, {
      dashboard: buildDashboardResponse({
        totals: {
          expenseSummary: {
            totalManualExpenses: 150,
            oilChangeSavings: 90,
            netExpenses: 60,
            oilChangeIntervalCount: 2,
          },
        },
      }),
    });
  });

  await recorder.step("open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("assert expense summary breakdown", async () => {
    await expect(page.getByText("Total Expenses")).toBeVisible();
    await expect(page.getByText("Oil Change Savings")).toBeVisible();
    await expect(page.getByText("Net Expenses")).toBeVisible();
    await expect(page.getByText("$150.00")).toBeVisible();
    await expect(page.getByText("$90.00")).toBeVisible();
    await expect(page.getByText("$60.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_net_expense_includes_oil_savings");
  await recorder.save(testInfo);
});
