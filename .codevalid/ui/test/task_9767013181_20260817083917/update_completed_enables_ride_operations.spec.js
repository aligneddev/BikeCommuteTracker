import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("Ride operations are enabled immediately after successful update", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "update_completed_enables_ride_operations",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare authenticated post-update ride page", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("open record ride page after update completes", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("assert ride operations are enabled", async () => {
    await expect(page.getByText("Updating Commute Bike Tracker... Please wait.")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Start Ride" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:update_completed_enables_ride_operations");
  await recorder.save(testInfo);
});
