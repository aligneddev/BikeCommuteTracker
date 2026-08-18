import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("Invalid preset data (missing miles, non-numeric) is prevented from loading", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("record_ride_handles_invalid_preset_data", "Invalid preset data (missing miles, non-numeric) is prevented from loading");

  const presets = [
    {
      presetId: 801,
      name: "Corrupted Preset",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:20",
      durationMinutes: 15,
      miles: null,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets });

  await recorder.step("Open Record Ride page");
  await page.goto("/rides/record");

  await recorder.step("Select corrupted preset and apply it");
  await page.locator("#ridePreset").selectOption("801");
  await page.getByRole("button", { name: "Apply Preset" }).click();

  await recorder.step("Assert the UI does not present a valid miles value");
  await expect(page.locator("#miles")).toHaveValue("");

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_handles_invalid_preset_data");
  await recorder.save(testInfo);
});
