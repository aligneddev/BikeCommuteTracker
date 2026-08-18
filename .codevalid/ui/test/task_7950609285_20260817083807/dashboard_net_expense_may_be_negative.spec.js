import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardNegativeNetExpenseScenario } from "../../helpers/mock-api.js";

test("dashboard_net_expense_may_be_negative", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_net_expense_may_be_negative", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard response with negative net expense", async () => {
    await mockDashboardNegativeNetExpenseScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify net expense is presented as savings", async () => {
    await expect(page.getByText("Net Expense")).toBeVisible();
    await expect(page.getByText("$140 saved")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_net_expense_may_be_negative");
  await recorder.save(testInfo);
});
