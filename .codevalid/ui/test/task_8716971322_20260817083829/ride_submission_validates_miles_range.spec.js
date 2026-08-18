import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride submission validates miles are between 0.1 and 200", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_submission_validates_miles_range",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and ride page APIs", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("Open the Record Ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Enter out-of-range miles and submit", async () => {
    await page.locator("#miles").fill("201");
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify save is blocked and entered value is preserved", async () => {
    await expect(page.getByText("Miles must be less than or equal to 200")).toBeVisible();
    await expect(page.locator("#miles")).toHaveValue("201");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_submission_validates_miles_range");
  await recorder.save(testInfo);
});
