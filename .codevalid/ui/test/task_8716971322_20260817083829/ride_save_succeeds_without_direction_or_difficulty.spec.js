import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride saves successfully without Primary Travel Direction or Difficulty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_save_succeeds_without_direction_or_difficulty",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and successful ride save", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("Open the Record Ride page and fill only required fields", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("10.0");
    await expect(page.locator("#primaryTravelDirection")).toHaveValue("");
    await expect(page.locator("#difficulty")).toHaveValue("");
  });

  await recorder.step("Submit the ride form", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify successful save message", async () => {
    await expect(page.getByText(/Ride recorded successfully \(ID: 701\)/)).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_save_succeeds_without_direction_or_difficulty");
  await recorder.save(testInfo);
});
