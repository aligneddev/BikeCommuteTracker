import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePresetsScenario,
} from "../../helpers/mock-api.js";

test("RecordRidePage shows empty state or placeholder when no presets exist", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("record_ride_no_presets_available", "RecordRidePage shows empty state or placeholder when no presets exist");

  await setupAuthenticatedSession(page);
  await setupRecordRidePresetsScenario(page, { presets: [] });

  await recorder.step("Open Record Ride page with no presets");
  await page.goto("/rides/record");

  await recorder.step("Assert preset selector is absent and manual fields remain available");
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  await expect(page.locator("#ridePreset")).toHaveCount(0);
  await expect(page.locator("#miles")).toHaveValue("");
  await expect(page.locator("#rideMinutes")).toHaveValue("");
  await expect(page.locator("#primaryTravelDirection")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Record Ride" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_no_presets_available");
  await recorder.save(testInfo);
});
