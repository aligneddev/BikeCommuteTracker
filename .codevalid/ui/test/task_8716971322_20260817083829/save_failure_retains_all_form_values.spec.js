import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";
import { trailLoopPreset } from "../../mock/mock-data.js";

test("backend save failure retains all form values and shows error, allowing retry", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "save_failure_retains_all_form_values",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and failing ride save endpoint", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      presets: [trailLoopPreset],
      saveFailure: {
        status: 500,
        message: "Failed to save ride. Please try again.",
      },
    });
  });

  await recorder.step("Open the Record Ride page and populate the form", async () => {
    await page.goto("/rides/record");
    await page.locator("#ridePreset").selectOption(String(trailLoopPreset.presetId));
    await page.getByRole("button", { name: "Apply Preset" }).click();
    await page.locator("#temperature").fill("85");
    await page.locator("#windSpeedMph").fill("12");
    await page.locator("#windDirectionDeg").fill("180");
    await page.locator("#relativeHumidityPercent").fill("44");
    await page.locator("#cloudCoverPercent").fill("30");
    await page.locator("#precipitationType").fill("Rain");
    await page.locator("#gasPrice").fill("3.20");
    await page.locator("#notes").fill("Keep all values after save failure.");
    await page.locator("#difficulty").selectOption("3");
  });

  await recorder.step("Submit and trigger backend failure", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
  });

  await recorder.step("Verify error message and retained form values", async () => {
    await expect(page.getByText("Failed to save ride. Please try again.")).toBeVisible();
    await expect(page.locator("#ridePreset")).toHaveValue(String(trailLoopPreset.presetId));
    await expect(page.locator("#miles")).toHaveValue("15.2");
    await expect(page.locator("#rideMinutes")).toHaveValue("60");
    await expect(page.locator("#temperature")).toHaveValue("85");
    await expect(page.locator("#windSpeedMph")).toHaveValue("12");
    await expect(page.locator("#windDirectionDeg")).toHaveValue("180");
    await expect(page.locator("#relativeHumidityPercent")).toHaveValue("44");
    await expect(page.locator("#cloudCoverPercent")).toHaveValue("30");
    await expect(page.locator("#precipitationType")).toHaveValue("Rain");
    await expect(page.locator("#gasPrice")).toHaveValue("3.2");
    await expect(page.locator("#notes")).toHaveValue("Keep all values after save failure.");
    await expect(page.locator("#difficulty")).toHaveValue("3");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:save_failure_retains_all_form_values");
  await recorder.save(testInfo);
});
