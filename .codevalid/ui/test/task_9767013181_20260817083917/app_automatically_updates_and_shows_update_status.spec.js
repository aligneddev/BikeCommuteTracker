import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Installed app automatically checks for and shows update status on launch with network", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "app_automatically_updates_and_shows_update_status",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare online launch", async () => {
    await setupUnauthenticatedSession(page);
    await setupHealthyStartupGuard(page);
  });

  await recorder.step("launch app", async () => {
    await page.goto("/login");
  });

  await recorder.step("assert dedicated update status is displayed", async () => {
    await expect(page.getByText("Updating Commute Bike Tracker... Please wait.")).toBeVisible();
    await expect(page.getByText("Connecting…")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Record a Ride" })).not.toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:app_automatically_updates_and_shows_update_status");
  await recorder.save(testInfo);
});
