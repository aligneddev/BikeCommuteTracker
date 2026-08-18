import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardExpensesScenario } from "../../helpers/mock-api.js";

test("dashboard_total_manual_expenses_summed", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_total_manual_expenses_summed", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard expense summary", async () => {
    await mockDashboardExpensesScenario(page);
  });

  await recorder.step("Load dashboard page", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify manual expenses total", async () => {
    await expect(page.getByText("Manual Expenses")).toBeVisible();
    await expect(page.getByText("$65.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_total_manual_expenses_summed");
  await recorder.save(testInfo);
});
