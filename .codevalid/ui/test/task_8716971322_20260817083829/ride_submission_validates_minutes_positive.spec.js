import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride submission validates minutes are positive when provided", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_submission_validates_minutes_positive",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and ride page APIs", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("Open the Record Ride page and fill required fields", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("10");
    await page.locator("#rideMinutes").fill("0");
  });

  await recorder.step("Submit the ride form", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify minutes validation message and preserved value", async () => {
    await expect(page.getByText("Ride minutes must be greater than 0")).toBeVisible();
    await expect(page.locator("#rideMinutes")).toHaveValue("0");
    await expect(page.locator("#miles")).toHaveValue("10");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_submission_validates_minutes_positive");
  await recorder.save(testInfo);
});
