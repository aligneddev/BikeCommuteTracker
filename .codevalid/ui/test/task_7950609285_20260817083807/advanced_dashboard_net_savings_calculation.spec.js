import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardNegativeNetSavingsScenario } from "../../helpers/mock-api.js";

test("advanced_dashboard_net_savings_calculation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("advanced_dashboard_net_savings_calculation", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard negative net savings", async () => {
    await mockAdvancedDashboardNegativeNetSavingsScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify monthly net savings is negative and visible", async () => {
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
    await expect(page.getByText("-$30.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_net_savings_calculation");
  await recorder.save(testInfo);
});
