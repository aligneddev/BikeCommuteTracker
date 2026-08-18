import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride submission validates gas price is blank or positive decimal", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_submission_validates_gas_price",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and ride page APIs", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("Open the Record Ride page and enter invalid gas price", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("12.5");
    await page.locator("#gasPrice").fill("-2.5");
  });

  await recorder.step("Submit the ride form", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify validation message and preserved gas price", async () => {
    await expect(page.getByText("Gas price must be a number between 0.01 and 999.9999")).toBeVisible();
    await expect(page.locator("#gasPrice")).toHaveValue("-2.5");
    await expect(page.locator("#miles")).toHaveValue("12.5");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_submission_validates_gas_price");
  await recorder.save(testInfo);
});
