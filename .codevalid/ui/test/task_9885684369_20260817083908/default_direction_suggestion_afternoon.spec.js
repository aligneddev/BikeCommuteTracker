import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Afternoon preset defaults to NE as primary direction", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("default_direction_suggestion_afternoon", "Afternoon preset defaults to NE as primary direction");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and choose the afternoon period tag");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await page.locator("#presetPeriodTag").selectOption("afternoon");

  await recorder.step("Verify the direction select defaults to NE and remains editable");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("NE");
  await page.locator("#presetPrimaryDirection").selectOption("SW");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("SW");

  console.log("CODEVALID_TEST_ASSERTION_OK:default_direction_suggestion_afternoon");
  await recorder.save(testInfo);
});
