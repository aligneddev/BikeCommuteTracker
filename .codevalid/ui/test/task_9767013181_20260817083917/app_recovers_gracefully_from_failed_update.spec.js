import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("App allows continued use if automatic update fails", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "app_recovers_gracefully_from_failed_update",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare authenticated current-version access", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("open app after failed update attempt", async () => {
    await page.goto("/rides/record");
  });

  await recorder.step("assert graceful fallback to current version", async () => {
    await expect(page.getByText("Update failed. Please try again later.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry Update" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Ride" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:app_recovers_gracefully_from_failed_update");
  await recorder.save(testInfo);
});
