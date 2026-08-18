import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Morning preset defaults to SW as primary direction", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("default_direction_suggestion_morning", "Morning preset defaults to SW as primary direction");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and choose the morning period tag");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await page.locator("#presetPeriodTag").selectOption("morning");

  await recorder.step("Verify the direction select defaults to SW and remains editable");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("SW");
  await page.locator("#presetPrimaryDirection").selectOption("NW");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("NW");

  console.log("CODEVALID_TEST_ASSERTION_OK:default_direction_suggestion_morning");
  await recorder.save(testInfo);
});
