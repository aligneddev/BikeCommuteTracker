import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("Preset correctly populates start time, duration, and miles fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("preset_populates_start_time_duration_miles", "Preset correctly populates start time, duration, and miles fields");

  const presets = [
    {
      presetId: 601,
      name: "Evening Workout",
      primaryDirection: "NE",
      periodTag: "afternoon",
      exactStartTimeLocal: "18:30",
      durationMinutes: 45,
      miles: 7.1,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets });

  await recorder.step("Open Record Ride page");
  await page.goto("/rides/record");

  await recorder.step("Select and apply Evening Workout preset");
  await page.locator("#ridePreset").selectOption("601");
  await page.getByRole("button", { name: "Apply Preset" }).click();

  await recorder.step("Assert preset values populate date/time, duration, and miles");
  await expect(page.locator("#rideDateTimeLocal")).toHaveValue(/T18:30$/);
  await expect(page.locator("#rideMinutes")).toHaveValue("45");
  await expect(page.locator("#miles")).toHaveValue("7.1");

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_populates_start_time_duration_miles");
  await recorder.save(testInfo);
});
