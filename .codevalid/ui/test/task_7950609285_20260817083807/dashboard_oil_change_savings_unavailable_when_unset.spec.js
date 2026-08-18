import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardOilChangeUnavailableScenario } from "../../helpers/mock-api.js";

test("dashboard_oil_change_savings_unavailable_when_unset", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_oil_change_savings_unavailable_when_unset", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard response with unavailable oil change savings", async () => {
    await mockDashboardOilChangeUnavailableScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify unavailable oil change savings copy", async () => {
    await expect(page.getByText("Oil Change Savings")).toBeVisible();
    await expect(page.getByText("Unavailable")).toBeVisible();
    await expect(page.getByText("Set oil change cost in settings to calculate savings")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_oil_change_savings_unavailable_when_unset");
  await recorder.save(testInfo);
});
