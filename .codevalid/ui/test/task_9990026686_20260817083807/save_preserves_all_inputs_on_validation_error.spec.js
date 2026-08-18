import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";

test("form state is preserved on validation error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "save_preserves_all_inputs_on_validation_error",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed page", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page);
  });

  await recorder.step("Open page and fill multiple fields with invalid miles", async () => {
    await page.goto("/rides/record");
    await page.locator("#miles").fill("0");
    await page.locator("#gasPrice").fill("3.50");
    await page.locator("#notes").fill("Great ride!");
    await page.locator("#temperature").fill("72");
    await page.locator("#primaryTravelDirection").selectOption("East");
    await page.locator("#difficulty").selectOption("3");
  });

  await recorder.step("Submit invalid form and assert values preserved", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Miles must be greater than 0")).toBeVisible();
    await expect(page.locator("#miles")).toHaveValue("0");
    await expect(page.locator("#gasPrice")).toHaveValue("3.50");
    await expect(page.locator("#notes")).toHaveValue("Great ride!");
    await expect(page.locator("#temperature")).toHaveValue("72");
    await expect(page.locator("#primaryTravelDirection")).toHaveValue("East");
    await expect(page.locator("#difficulty")).toHaveValue("3");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:save_preserves_all_inputs_on_validation_error");
  await recorder.save(testInfo);
});
