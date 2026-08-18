import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardDifficultyStoredValuesScenario } from "../../helpers/mock-api.js";

test("ride_difficulty_analytics_with_stored_values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("ride_difficulty_analytics_with_stored_values", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard difficulty analytics", async () => {
    await mockAdvancedDashboardDifficultyStoredValuesScenario(page);
  });

  await recorder.step("Open advanced dashboard difficulty section", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify stored difficulty values drive analytics", async () => {
    await expect(page.getByRole("heading", { name: "Ride Difficulty" })).toBeVisible();
    await expect(page.getByText("3.5")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toBeVisible();
    await expect(page.getByText("January")).toBeVisible();
    await expect(page.getByText("March")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_difficulty_analytics_with_stored_values");
  await recorder.save(testInfo);
});
