import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupInstalledOfflineMode,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("Ride operation blocked when installed app is offline", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "record_ride_offline_blocked",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated installed offline session", async () => {
    await setupAuthenticatedSession(page);
    await setupInstalledOfflineMode(page);
    await setupRecordRidePageScenario(page);
  });

  await recorder.step("navigate to record ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("attempt ride operation while offline", async () => {
    await expect(
      page.getByText(
        "Connectivity required: this installed app needs an internet connection for ride operations."
      )
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();

    await page.locator("#miles").fill("8.5");
    await page.getByRole("button", { name: "Start Ride" }).click();
  });

  await recorder.step("verify ride operation is blocked with clear message", async () => {
    await expect(
      page.getByText(
        "Connectivity required: reconnect to the internet to record rides in installed mode."
      )
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:record_ride_offline_blocked");
  await recorder.save(testInfo);
});
