import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("User can update an existing preset with new values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("update_existing_preset", "User can update an existing preset with new values");

  const initialPresets = [
    {
      presetId: 31,
      name: "Gym Trip",
      primaryDirection: "NW",
      periodTag: "afternoon",
      exactStartTimeLocal: "17:30",
      durationMinutes: 25,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:00:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and preset-management mocks with an editable preset");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets });

  await recorder.step("Open Settings and start editing the existing preset");
  await page.goto("/settings");
  const presetItem = page.locator(".settings-presets-item").filter({ hasText: "Gym Trip" });
  await presetItem.getByRole("button", { name: "Edit" }).click();

  await recorder.step("Update direction and miles, then save the preset");
  await expect(page.locator("#presetName")).toHaveValue("Gym Trip");
  await page.locator("#presetPrimaryDirection").selectOption("SW");
  await page.locator("#presetMiles").fill("6.1");
  await page.getByRole("button", { name: "Save Preset" }).click();

  await recorder.step("Verify updated values are shown and still present after reload");
  await expect(page.getByText("Preset updated.")).toBeVisible();
  await expect(page.getByText("Gym Trip (SW, afternoon, 17:30, 25 min, 6.1 mi)")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await expect(page.getByText("Gym Trip (SW, afternoon, 17:30, 25 min, 6.1 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:update_existing_preset");
  await recorder.save(testInfo);
});
