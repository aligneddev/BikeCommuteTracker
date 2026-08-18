import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardOilChangeCalculatedScenario } from "../../helpers/mock-api.js";

test("dashboard_oil_change_savings_calculation_with_price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_oil_change_savings_calculation_with_price", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard response with oil change savings", async () => {
    await mockDashboardOilChangeCalculatedScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify oil change savings and net expense presentation", async () => {
    await expect(page.getByText("Oil Change Savings")).toBeVisible();
    await expect(page.getByText("$180.00")).toBeVisible();
    await expect(page.getByText("Net Expense")).toBeVisible();
    await expect(page.getByText("$115 saved")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_oil_change_savings_calculation_with_price");
  await recorder.save(testInfo);
});
