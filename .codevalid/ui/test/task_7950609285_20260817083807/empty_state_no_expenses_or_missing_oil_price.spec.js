import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardNoExpensesMissingOilScenario } from "../../helpers/mock-api.js";

test("empty_state_no_expenses_or_missing_oil_price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("empty_state_no_expenses_or_missing_oil_price", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard response with no expenses and no oil setting", async () => {
    await mockDashboardNoExpensesMissingOilScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify zero expenses and unavailable oil savings are shown", async () => {
    await expect(page.getByText("Manual Expenses")).toBeVisible();
    await expect(page.getByText("$0.00")).toBeVisible();
    await expect(page.getByText("Unavailable")).toBeVisible();
    await expect(page.getByText("$0 saved")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:empty_state_no_expenses_or_missing_oil_price");
  await recorder.save(testInfo);
});
