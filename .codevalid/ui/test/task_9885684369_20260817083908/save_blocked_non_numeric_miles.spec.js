import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Save is blocked when miles field contains non-numeric value", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("save_blocked_non_numeric_miles", "Save is blocked when miles field contains non-numeric value");

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and enter a non-numeric miles value into the numeric miles input");
  await page.goto("/settings");
  await page.locator("#presetName").fill("Work Route");
  await page.locator("#presetMiles").fill("abc");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify save is blocked and no preset is created");
  await expect(page.locator("[role='alert']")).toContainText("Miles must be greater than 0.");
  await expect(page.getByText("Work Route (")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:save_blocked_non_numeric_miles");
  await recorder.save(testInfo);
});
