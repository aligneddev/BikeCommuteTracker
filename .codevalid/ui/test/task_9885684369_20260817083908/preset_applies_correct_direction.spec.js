import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("Preset direction is correctly pre-populated and normalized to canonical value", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("preset_applies_correct_direction", "Preset direction is correctly pre-populated and normalized to canonical value");

  const presets = [
    {
      presetId: 201,
      name: "Morning Commute",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:00",
      durationMinutes: 30,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets });

  await recorder.step("Open Record Ride page");
  await page.goto("/rides/record");
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();

  await recorder.step("Select Morning Commute preset and apply it");
  await page.locator("#ridePreset").selectOption("201");
  await page.getByRole("button", { name: "Apply Preset" }).click();

  await recorder.step("Assert canonical direction value is displayed");
  await expect(page.locator("#primaryTravelDirection")).toHaveValue("SW");

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_applies_correct_direction");
  await recorder.save(testInfo);
});
