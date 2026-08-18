import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("Record Ride page loads authenticated rider's preset collection on load", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("record_ride_loads_rider_presets", "Record Ride page loads authenticated rider's preset collection on load");

  const presets = [
    {
      presetId: 101,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:00",
      durationMinutes: 30,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
    {
      presetId: 102,
      name: "Commute Work",
      primaryDirection: "NE",
      periodTag: "afternoon",
      exactStartTimeLocal: "17:00",
      durationMinutes: 25,
      miles: 4.8,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T09:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets });

  await recorder.step("Navigate to Record Ride page");
  await page.goto("/rides/record");

  await recorder.step("Verify page heading and preset selector");
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  await expect(page.locator("#ridePreset")).toBeVisible();

  await recorder.step("Assert only rider presets are displayed in ordered options");
  const optionTexts = await page.locator("#ridePreset option").allTextContents();
  expect(optionTexts).toEqual([
    "-- Select a preset --",
    "Commute Home (morning, 07:00, 30 min, 5.2 mi)",
    "Commute Work (afternoon, 17:00, 25 min, 4.8 mi)",
  ]);
  await expect(page.locator("#ridePreset option", { hasText: "Commute Home" })).toBeVisible();
  await expect(page.locator("#ridePreset option", { hasText: "Commute Work" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_loads_rider_presets");
  await recorder.save(testInfo);
});
