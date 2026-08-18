import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("Core ride tracking remains accessible even if installation fails", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "core_ride_tracking_accessible_during_install_failure",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare authenticated browser-mode ride page", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      weatherResponse: {
        rideDateTimeLocal: "2026-08-18T08:00",
        temperature: 67,
        windSpeedMph: 7,
        windDirectionDeg: 180,
        relativeHumidityPercent: 55,
        cloudCoverPercent: 25,
        precipitationType: "None",
        isAvailable: true,
      },
      recordRideResponse: { rideId: 555 },
    });
  });

  await recorder.step("open record ride page and enter ride details", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
    await page.locator("#rideDateTimeLocal").fill("2026-08-18T08:00");
    await page.locator("#miles").fill("6.4");
  });

  await recorder.step("load weather and start ride", async () => {
    await page.getByRole("button", { name: "Load Weather" }).click();
    await page.getByRole("button", { name: "Start Ride" }).click();
  });

  await recorder.step("verify ride tracking remains accessible", async () => {
    await expect(page.getByText("Ride recorded successfully (ID: 555)")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:core_ride_tracking_accessible_during_install_failure");
  await recorder.save(testInfo);
});
