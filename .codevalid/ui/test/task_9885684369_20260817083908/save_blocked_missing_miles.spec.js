import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Save is blocked when miles field is empty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("save_blocked_missing_miles", "Save is blocked when miles field is empty");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and attempt to save a preset without miles");
  await page.goto("/settings");
  await page.locator("#presetName").fill("Home Route");
  await page.locator("#presetPeriodTag").selectOption("morning");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify saving is blocked with the implemented validation message");
  await expect(page.locator("[role='alert']")).toContainText("Miles must be greater than 0.");
  await expect(page.getByText("Home Route (")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:save_blocked_missing_miles");
  await recorder.save(testInfo);
});
