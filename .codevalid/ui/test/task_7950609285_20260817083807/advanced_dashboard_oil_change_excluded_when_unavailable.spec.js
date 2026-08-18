import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardOilUnavailableScenario } from "../../helpers/mock-api.js";

test("advanced_dashboard_oil_change_excluded_when_unavailable", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("advanced_dashboard_oil_change_excluded_when_unavailable", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard with unavailable oil savings", async () => {
    await mockAdvancedDashboardOilUnavailableScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify oil change savings is unavailable and net excludes it", async () => {
    await expect(page.getByText("Unavailable")).toBeVisible();
    await expect(page.getByText("$40.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_oil_change_excluded_when_unavailable");
  await recorder.save(testInfo);
});
