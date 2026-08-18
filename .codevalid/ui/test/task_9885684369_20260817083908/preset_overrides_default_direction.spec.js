import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("Rider override of default direction is preserved and applied", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("preset_overrides_default_direction", "Rider override of default direction is preserved and applied");

  const presets = [
    {
      presetId: 501,
      name: "Quick Commute",
      primaryDirection: "East",
      periodTag: "morning",
      exactStartTimeLocal: "07:10",
      durationMinutes: 20,
      miles: 3.3,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets });

  await recorder.step("Open Record Ride page");
  await page.goto("/rides/record");

  await recorder.step("Select Quick Commute and apply the preset");
  await page.locator("#ridePreset").selectOption("501");
  await page.getByRole("button", { name: "Apply Preset" }).click();

  await recorder.step("Assert explicit preset direction overrides default suggestion");
  await expect(page.locator("#primaryTravelDirection")).toHaveValue("East");

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_overrides_default_direction");
  await recorder.save(testInfo);
});
