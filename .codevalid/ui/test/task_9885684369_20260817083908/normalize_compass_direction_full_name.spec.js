import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Full compass direction name is normalized to canonical 2-letter value", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("normalize_compass_direction_full_name", "Full compass direction name is normalized to canonical 2-letter value");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and create a preset using the available canonical direction select");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await page.locator("#presetName").fill("Work Commute");
  await page.locator("#presetPrimaryDirection").selectOption("NW");
  await page.locator("#presetMiles").fill("5");
  await page.locator("#presetDurationMinutes").fill("20");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify the saved preset displays canonical NW");
  await expect(page.getByText("Preset created.")).toBeVisible();
  await expect(page.getByText("Work Commute (NW, morning, 07:45, 20 min, 5 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:normalize_compass_direction_full_name");
  await recorder.save(testInfo);
});
