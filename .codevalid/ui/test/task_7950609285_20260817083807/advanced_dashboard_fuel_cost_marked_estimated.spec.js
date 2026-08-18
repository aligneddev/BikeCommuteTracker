import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardEstimatedFuelScenario } from "../../helpers/mock-api.js";

test("advanced_dashboard_fuel_cost_marked_estimated", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("advanced_dashboard_fuel_cost_marked_estimated", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard with estimated fuel cost", async () => {
    await mockAdvancedDashboardEstimatedFuelScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify estimated fuel cost badge appears", async () => {
    await expect(page.getByText("$85.00")).toBeVisible();
    await expect(page.getByText("Est.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_fuel_cost_marked_estimated");
  await recorder.save(testInfo);
});
