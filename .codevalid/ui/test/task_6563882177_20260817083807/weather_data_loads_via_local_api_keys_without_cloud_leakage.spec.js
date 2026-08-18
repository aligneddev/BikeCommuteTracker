import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";
import { weatherLookupRide } from "../../mock/mock-data.js";

test("Weather data is loaded using local API keys without sending user rides or keys to the cloud", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "weather_data_loads_via_local_api_keys_without_cloud_leakage",
    testTitle: testInfo.title,
  });

  const requests = [];
  page.on("request", (request) => {
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() ?? "" });
  });

  await recorder.step("Arrange authenticated session, settings with local API key, and weather-capable ride", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page, {
      settings: {
        averageCarMpg: null,
        yearlyGoalMiles: null,
        oilChangePrice: null,
        mileageRateCents: null,
        locationLabel: null,
        latitude: 44.9778,
        longitude: -93.265,
        dashboardGallonsAvoidedEnabled: false,
        dashboardGoalProgressEnabled: false,
        weatherApiKey: "secret-open-meteo-key",
        eiaGasApiKey: "secret-eia-key",
      },
    });
    await setupRideHistoryScenario(page, {
      rides: [weatherLookupRide],
      weatherByDateTime: {
        "2024-08-11T06:30": {
          rideDateTimeLocal: "2024-08-11T06:30",
          temperature: 49.5,
          windSpeedMph: 4.8,
          windDirectionDeg: 180,
          relativeHumidityPercent: 70,
          cloudCoverPercent: 20,
          precipitationType: "none",
          isAvailable: true,
        },
      },
      gasPriceByDate: {
        "2024-08-11": {
          date: "2024-08-11",
          pricePerGallon: 3.4599,
          isAvailable: true,
          dataSource: "Source: (EIA)",
        },
      },
    });
  });

  await recorder.step("Open history, edit ride, and load weather", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Load Weather" }).click();
    await expect(page.locator("#edit-ride-temperature-501")).toHaveValue("49.5");
    await expect(page.locator("#edit-ride-wind-speed-501")).toHaveValue("4.8");
    await expect(page.locator("#edit-ride-precipitation-type-501")).toHaveValue("none");
  });

  await recorder.step("Verify outbound requests stay local and do not leak keys or ride notes externally", async () => {
    const nonLocal = requests.filter((item) => {
      try {
        const url = new URL(item.url);
        return !["localhost", "127.0.0.1"].includes(url.hostname);
      } catch {
        return false;
      }
    });
    expect(nonLocal).toEqual([]);

    for (const request of requests) {
      expect(request.url).not.toContain("secret-open-meteo-key");
      expect(request.url).not.toContain("secret-eia-key");
      expect(request.postData).not.toContain("Past ride note should stay local");
      expect(request.postData).not.toContain("secret-open-meteo-key");
      expect(request.postData).not.toContain("secret-eia-key");
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:weather_data_loads_via_local_api_keys_without_cloud_leakage");
  await recorder.save(testInfo);
});
