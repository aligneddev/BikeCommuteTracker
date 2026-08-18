import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardNoDifficultyOrWindScenario } from "../../helpers/mock-api.js";

test("dashboard_empty_state_no_difficulty_or_wind_data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_empty_state_no_difficulty_or_wind_data", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard empty difficulty/wind scenario", async () => {
    await mockAdvancedDashboardNoDifficultyOrWindScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify descriptive empty state is shown", async () => {
    await expect(page.getByText("Record rides with travel direction to see difficulty trends.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_empty_state_no_difficulty_or_wind_data");
  await recorder.save(testInfo);
});
