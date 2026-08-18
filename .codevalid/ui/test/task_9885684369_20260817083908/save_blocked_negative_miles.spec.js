import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Save is blocked when miles field contains a negative number", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("save_blocked_negative_miles", "Save is blocked when miles field contains a negative number");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and attempt to save a preset with negative miles");
  await page.goto("/settings");
  await page.locator("#presetName").fill("Short Trip");
  await page.locator("#presetMiles").fill("-5");
  await page.locator("#presetDurationMinutes").fill("15");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify the current validation blocks saving");
  await expect(page.locator("[role='alert']")).toContainText("Miles must be greater than 0.");
  await expect(page.getByText("Short Trip (")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:save_blocked_negative_miles");
  await recorder.save(testInfo);
});
