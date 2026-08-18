import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardNoRidesScenario } from "../../helpers/mock-api.js";

test("empty_state_no_rides", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("empty_state_no_rides", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard empty-state response", async () => {
    await mockDashboardNoRidesScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify no-rides empty state renders without errors", async () => {
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No ride history yet" })).toBeVisible();
    await expect(page.getByText("0.0 mi").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Miles by Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings by Month" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:empty_state_no_rides");
  await recorder.save(testInfo);
});
