import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Two-letter compass abbreviation is accepted and preserved as canonical", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("normalize_compass_direction_abbreviation", "Two-letter compass abbreviation is accepted and preserved as canonical");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and create a preset with canonical SE direction");
  await page.goto("/settings");
  await page.locator("#presetName").fill("Beach Trip");
  await page.locator("#presetPrimaryDirection").selectOption("SE");
  await page.locator("#presetMiles").fill("12.3");
  await page.locator("#presetDurationMinutes").fill("40");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify the saved preset displays SE");
  await expect(page.getByText("Preset created.")).toBeVisible();
  await expect(page.getByText("Beach Trip (SE, morning, 07:45, 40 min, 12.3 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:normalize_compass_direction_abbreviation");
  await recorder.save(testInfo);
});
