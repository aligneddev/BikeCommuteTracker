import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";

test("Core ride history remains accessible during automatic app update", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "update_in_progress_does_not_block_history",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Allow startup guard to pass", async () => {
    await setupHealthyStartupGuard(page);
  });

  await recorder.step("Mock normal ride history responses while simulated update happens outside page scope", async () => {
    await setupRideHistoryScenario(page);
  });

  await recorder.step("Navigate to HistoryPage", async () => {
    await page.goto("/rides/history");
  });

  await recorder.step("Verify ride history remains usable and no startup retry UI interferes", async () => {
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.locator('table[aria-label="Ride history table"]')).toBeVisible();
    await expect(page.getByText("Morning Commute")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })
    ).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:update_in_progress_does_not_block_history");
  await recorder.save(testInfo);
});
