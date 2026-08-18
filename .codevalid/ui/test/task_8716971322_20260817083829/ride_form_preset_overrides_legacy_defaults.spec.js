import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";
import { trailLoopPreset, defaultRideWeather } from "../../mock/mock-data.js";

test("preset values override last-ride defaults when presets exist", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_form_preset_overrides_legacy_defaults",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and ride preset data", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      presets: [trailLoopPreset],
      weatherResponse: {
        ...defaultRideWeather,
        rideDateTimeLocal: "2024-06-10T08:00",
      },
    });
  });

  await recorder.step("Open the Record Ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Select and apply the Trail Loop preset", async () => {
    await page.locator("#ridePreset").selectOption(String(trailLoopPreset.presetId));
    await page.getByRole("button", { name: "Apply Preset" }).click();
  });

  await recorder.step("Verify preset values populate the form", async () => {
    await expect(page.locator("#miles")).toHaveValue("15.2");
    await expect(page.locator("#rideMinutes")).toHaveValue("60");
    await expect(page.locator("#primaryTravelDirection")).toHaveValue("South");
    await expect(page.locator("#rideDateTimeLocal")).toHaveValue(/T08:00$/);
  });

  await recorder.step("Verify preset-populated values remain editable", async () => {
    await page.locator("#miles").fill("16.4");
    await expect(page.locator("#miles")).toHaveValue("16.4");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_form_preset_overrides_legacy_defaults");
  await recorder.save(testInfo);
});
