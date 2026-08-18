import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
  mockSettingsPageData,
  mockUnsupportedPwaEnvironment,
} from "../../helpers/mock-api.js";
import { unsupportedPwaRide } from "../../mock/mock-data.js";

test("Core ride tracking flows remain fully accessible when PWA installation is unsupported", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "history_page_functional_in_unsupported_pwa_environment",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session, unsupported PWA environment, and ride mocks", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_browser" });
    await setupRideHistoryScenario(page, {
      rides: [unsupportedPwaRide],
      weatherByDateTime: {
        "2024-08-15T07:30": {
          rideDateTimeLocal: "2024-08-15T07:30",
          temperature: 61.4,
          windSpeedMph: 6.2,
          windDirectionDeg: 210,
          relativeHumidityPercent: 58,
          cloudCoverPercent: 35,
          precipitationType: "none",
          isAvailable: true,
        },
      },
    });
  });

  await recorder.step("Open settings and verify unsupported install guidance", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
    await expect(
      page.getByText("Installation is not available in this browser in v1. Use current Chrome or Edge on Windows, or continue using browser mode.")
    ).toBeVisible();
  });

  await recorder.step("Navigate to history and verify page remains fully usable", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("Unsupported-browser commute", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  await recorder.step("Edit the ride and save successfully", async () => {
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-miles-301").fill("11.2");
    await page.locator("#edit-ride-note-301").fill("Edited in unsupported environment");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("11.2", { exact: false })).toBeVisible();
  });

  await recorder.step("Delete the edited ride and confirm the workflow is not blocked", async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete Ride" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("No rides found for this rider.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_page_functional_in_unsupported_pwa_environment");
  await recorder.save(testInfo);
});
