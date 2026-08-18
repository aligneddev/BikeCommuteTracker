import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("User can create a new preset with valid name and positive miles", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("create_preset_with_valid_miles_and_name", "User can create a new preset with valid name and positive miles");

  await recorder.step("Set authenticated rider session and empty initial presets");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: [] });

  await recorder.step("Open Settings and confirm Ride Presets section is available");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();

  await recorder.step("Create a new morning preset with valid positive miles and duration");
  await page.locator("#presetName").fill("Work Commute");
  await page.locator("#presetPeriodTag").selectOption("morning");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("SW");
  await page.locator("#presetMiles").fill("8.5");
  await page.locator("#presetDurationMinutes").fill("30");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.step("Verify the preset is saved and rendered in the list");
  await expect(page.getByText("Preset created.")).toBeVisible();
  await expect(page.locator("[role='alert']")).toHaveCount(0);
  await expect(page.getByText("Work Commute (SW, morning, 07:45, 30 min, 8.5 mi)")).toBeVisible();
  await expect(page.locator("#presetName")).toHaveValue("");
  await expect(page.locator("#presetMiles")).toHaveValue("");
  await expect(page.locator("#presetDurationMinutes")).toHaveValue("");

  console.log("CODEVALID_TEST_ASSERTION_OK:create_preset_with_valid_miles_and_name");
  await recorder.save(testInfo);
});
