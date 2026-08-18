import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";
import { noCloudSyncRideOne, noCloudSyncRideTwo } from "../../mock/mock-data.js";

test("No user data (rides, keys, settings) is transmitted to any cloud or remote service", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "no_data_synced_to_cloud_or_remote_services",
    testTitle: testInfo.title,
  });

  const requests = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      postData: request.postData() ?? "",
    });
  });

  await recorder.step("Arrange authenticated local-first session with settings and ride history", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page, {
      settings: {
        averageCarMpg: 28.4,
        yearlyGoalMiles: 1000,
        oilChangePrice: 59,
        mileageRateCents: 67,
        locationLabel: "Home",
        latitude: 44.9778,
        longitude: -93.265,
        dashboardGallonsAvoidedEnabled: true,
        dashboardGoalProgressEnabled: true,
        weatherApiKey: "private-weather-key",
        eiaGasApiKey: "private-eia-key",
      },
    });
    await setupRideHistoryScenario(page, {
      rides: [noCloudSyncRideOne, noCloudSyncRideTwo],
      weatherByDateTime: {
        "2024-08-21T07:15": {
          rideDateTimeLocal: "2024-08-21T07:15",
          temperature: 63.2,
          windSpeedMph: 7.1,
          windDirectionDeg: 190,
          relativeHumidityPercent: 52,
          cloudCoverPercent: 15,
          precipitationType: "none",
          isAvailable: true,
        },
      },
      gasPriceByDate: {
        "2024-08-21": {
          date: "2024-08-21",
          pricePerGallon: 3.5199,
          isAvailable: true,
          dataSource: "Source: (EIA)",
        },
      },
    });
  });

  await recorder.step("Perform add-like, edit, delete, and weather-loading user flows within history UI", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.locator("#edit-ride-note-801").fill("Edited locally only");
    await page.getByRole("button", { name: "Load Weather" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("8.8", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).last().click();
    await expect(page.getByRole("heading", { name: "Delete Ride" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
  });

  await recorder.step("Assert all observed traffic remained on localhost and did not leak keys or ride metadata to vendor domains", async () => {
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      const url = new URL(request.url);
      expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
      expect(request.url).not.toContain("private-weather-key");
      expect(request.url).not.toContain("private-eia-key");
      expect(request.postData).not.toContain("private-weather-key");
      expect(request.postData).not.toContain("private-eia-key");
      expect(request.postData).not.toContain("Morning note stays local");
      expect(request.postData).not.toContain("Edited locally only");
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:no_data_synced_to_cloud_or_remote_services");
  await recorder.save(testInfo);
});
