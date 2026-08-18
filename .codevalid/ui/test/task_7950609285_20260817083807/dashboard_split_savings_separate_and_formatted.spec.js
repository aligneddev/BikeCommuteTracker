import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardSplitSavingsScenario } from "../../helpers/mock-api.js";

test("dashboard_split_savings_separate_and_formatted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_split_savings_separate_and_formatted", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard split savings response", async () => {
    await mockDashboardSplitSavingsScenario(page);
  });

  await recorder.step("Open dashboard page", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify split savings metrics are separate and formatted", async () => {
    await expect(page.getByText("Money Saved")).toBeVisible();
    await expect(page.getByText("$39.00").first()).toBeVisible();
    await expect(page.getByText("Mileage rate savings $39.00")).toBeVisible();
    await expect(page.getByText("Gallons-based savings $8.75")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_split_savings_separate_and_formatted");
  await recorder.save(testInfo);
});
