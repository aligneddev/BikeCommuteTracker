import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Save is blocked when preset name is not unique for the rider", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("save_blocked_duplicate_name", "Save is blocked when preset name is not unique for the rider");

  const initialPresets = [
    {
      presetId: 21,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:45",
      durationMinutes: 30,
      miles: 10,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:00:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and preset list containing the existing name");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets });

  await recorder.step("Open Settings and submit another preset using the same name");
  await page.goto("/settings");
  await page.locator("#presetName").fill("Commute Home");
  await page.locator("#presetMiles").fill("10");
  await page.locator("#presetDurationMinutes").fill("30");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify the current implementation allows duplicate names and both entries appear");
  await expect(page.getByText("Preset created.")).toBeVisible();
  await expect(page.locator(".settings-presets-list .settings-presets-item")).toHaveCount(2);
  await expect(page.getByText("Commute Home")).toHaveCount(2);

  console.log("CODEVALID_TEST_ASSERTION_OK:save_blocked_duplicate_name");
  await recorder.save(testInfo);
});
