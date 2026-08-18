import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride submission validates note text is ≤ 500 characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_submission_validates_note_length",
    testTitle: testInfo.title,
  });

  const longNote = "a".repeat(501);

  await recorder.step("Seed authenticated session and ride page APIs", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("Open the Record Ride page and inject an overlong note value", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("9.1");
    await page.locator("#notes").evaluate((element, value) => {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, longNote);
  });

  await recorder.step("Submit the ride form", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify note validation message and preserved content", async () => {
    await expect(page.getByText("Note must be 500 characters or fewer")).toBeVisible();
    await expect(page.locator("#notes")).toHaveValue(longNote);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_submission_validates_note_length");
  await recorder.save(testInfo);
});
