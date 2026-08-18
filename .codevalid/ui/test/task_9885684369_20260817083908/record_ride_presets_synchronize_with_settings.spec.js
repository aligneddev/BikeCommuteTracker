import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
} from "../../helpers/mock-api.js";

test("Changes to presets in settings section are reflected instantly on RecordRidePage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("record_ride_presets_synchronize_with_settings", "Changes to presets in settings section are reflected instantly on RecordRidePage");

  const initialPresets = [
    {
      presetId: 901,
      name: "Test Preset",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:15",
      durationMinutes: 20,
      miles: 3.8,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupPresetManagementScenario(page, { initialPresets });

  await recorder.step("Open Record Ride page and verify preset exists");
  await page.goto("/rides/record");
  await expect(page.locator("#ridePreset option", { hasText: "Test Preset" })).toBeVisible();

  await recorder.step("Open username menu and navigate to Settings");
  await page.getByRole("button", { name: "johndoe" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();

  await recorder.step("Delete Test Preset in settings");
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Preset deleted.")).toBeVisible();

  await recorder.step("Return to Record Ride and verify preset is gone after page revisit");
  await page.getByRole("link", { name: "Record Ride" }).click();
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  await expect(page.locator("#ridePreset")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_presets_synchronize_with_settings");
  await recorder.save(testInfo);
});
