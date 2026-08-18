import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupEditableRecordRideScenario,
} from "../../helpers/mock-api.js";

test("Editing ride fields after preset application does not alter the preset definition", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("editing_ride_does_not_change_preset", "Editing ride fields after preset application does not alter the preset definition");

  const presets = [
    {
      presetId: 701,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:00",
      durationMinutes: 30,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T08:00:00Z",
    },
  ];

  await setupAuthenticatedSession(page);
  await setupEditableRecordRideScenario(page, {
    presets,
    recordRideResponse: {
      rideId: 901,
      riderId: 1,
      savedAtUtc: "2026-08-18T10:00:00Z",
      eventStatus: "recorded",
    },
  });

  await recorder.step("Open Record Ride page");
  await page.goto("/rides/record");

  await recorder.step("Select Commute Home and apply preset values");
  await page.locator("#ridePreset").selectOption("701");
  await page.getByRole("button", { name: "Apply Preset" }).click();
  await expect(page.locator("#primaryTravelDirection")).toHaveValue("SW");
  await expect(page.locator("#miles")).toHaveValue("5.2");

  await recorder.step("Edit direction and miles for the current ride only");
  await page.locator("#primaryTravelDirection").selectOption("NW");
  await page.locator("#miles").fill("6.0");

  await recorder.step("Save the ride");
  await page.getByRole("button", { name: "Record Ride" }).click();
  await expect(page.getByText("Ride recorded successfully (ID: 901)")).toBeVisible();

  await recorder.step("Reload page and verify original preset values remain unchanged");
  await page.goto("/rides/record");
  await page.locator("#ridePreset").selectOption("701");
  await page.getByRole("button", { name: "Apply Preset" }).click();
  await expect(page.locator("#primaryTravelDirection")).toHaveValue("SW");
  await expect(page.locator("#rideDateTimeLocal")).toHaveValue(/T07:00$/);
  await expect(page.locator("#rideMinutes")).toHaveValue("30");
  await expect(page.locator("#miles")).toHaveValue("5.2");

  console.log("CODEVALID_TEST_ASSERTION_OK:editing_ride_does_not_change_preset");
  await recorder.save(testInfo);
});
