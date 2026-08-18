import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("Ride operations are blocked during active app update", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "update_in_progress_blocks_ride_operations",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare authenticated ride page access", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("open record ride page while update is active", async () => {
    await page.goto("/rides/record");
  });

  await recorder.step("assert update blocks ride operations", async () => {
    await expect(page.getByText("Updating Commute Bike Tracker... Please wait.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Ride" })).toBeDisabled();
    await expect(
      page.getByText(
        "Please wait while the app updates. Ride recording will be available after update completes."
      )
    ).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:update_in_progress_blocks_ride_operations");
  await recorder.save(testInfo);
});
