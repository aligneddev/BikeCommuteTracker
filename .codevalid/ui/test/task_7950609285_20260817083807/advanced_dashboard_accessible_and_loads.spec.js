import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardAccessibleScenario } from "../../helpers/mock-api.js";

test("advanced_dashboard_accessible_and_loads", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("advanced_dashboard_accessible_and_loads", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard response", async () => {
    await mockAdvancedDashboardAccessibleScenario(page);
  });

  await recorder.step("Navigate directly to advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify advanced dashboard loads for authenticated user", async () => {
    await expect(page).toHaveURL(/\/dashboard\/advanced$/);
    await expect(page.getByRole("heading", { name: "Deep-dive into your savings." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
    await expect(page.getByText("This Week")).toBeVisible();
    await expect(page.getByText("This Month")).toBeVisible();
    await expect(page.getByText("This Year")).toBeVisible();
    await expect(page.getByText("All Time")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:advanced_dashboard_accessible_and_loads");
  await recorder.save(testInfo);
});
