import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";

test("note field blocks more than 500 characters on save", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "note_field_validates_500_char_limit",
    testTitle: testInfo.title,
  });
  const longNote = "x".repeat(501);

  await recorder.step("Seed authenticated ride page", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page);
  });

  await recorder.step("Open page and fill required fields", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("10");
    await page.locator("#notes").fill(longNote);
  });

  await recorder.step("Submit and observe validation", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Note must be 500 characters or fewer")).toBeVisible();
    await expect(page.locator("#notes")).toHaveValue(longNote);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:note_field_validates_500_char_limit");
  await recorder.save(testInfo);
});
