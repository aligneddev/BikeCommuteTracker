import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupInstalledOfflineMode,
  restoreOnlineMode,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("Ride operation resumes after network restoration and retry", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "record_ride_retries_and_succeeds_after_connectivity_restored",
    testTitle: testInfo.title,
  });

  await recorder.step("seed blocked installed session", async () => {
    await setupAuthenticatedSession(page);
    await setupInstalledOfflineMode(page);
    await setupRecordRidePageScenario(page, {
      recordRideResponse: { rideId: 321 },
    });
  });

  await recorder.step("open record ride page and enter ride data", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
    await page.locator("#miles").fill("12.2");
    await page.locator("#rideMinutes").fill("35");
    await page.locator("#notes").fill("Morning office commute");
    await expect(
      page.getByText(
        "Connectivity required: this installed app needs an internet connection for ride operations."
      )
    ).toBeVisible();
  });

  await recorder.step("restore connectivity and retry", async () => {
    await restoreOnlineMode(page);
    await page.getByRole("button", { name: "Retry connection" }).click();
    await expect(page.getByText("Connection restored. Retry your action.")).toBeVisible();
  });

  await recorder.step("verify data is preserved and submission succeeds", async () => {
    await expect(page.locator("#miles")).toHaveValue("12.2");
    await expect(page.locator("#rideMinutes")).toHaveValue("35");
    await expect(page.locator("#notes")).toHaveValue("Morning office commute");

    await page.getByRole("button", { name: "Start Ride" }).click();
    await expect(page.getByText("Ride recorded successfully (ID: 321)")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_retries_and_succeeds_after_connectivity_restored");
  await recorder.save(testInfo);
});
