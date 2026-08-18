import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";
import { apiKeyPrivacyRide } from "../../mock/mock-data.js";

test("Per-rider API keys are never displayed or exposed in the HistoryPage or related UIs", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_keys_not_displayed_or_exposed_in_ui",
    testTitle: testInfo.title,
  });

  const consoleMessages = [];
  page.on("console", (msg) => {
    consoleMessages.push(msg.text());
  });

  await recorder.step("Arrange authenticated session, settings with stored keys, and ride history", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page, {
      settings: {
        averageCarMpg: null,
        yearlyGoalMiles: null,
        oilChangePrice: null,
        mileageRateCents: null,
        locationLabel: null,
        latitude: null,
        longitude: null,
        dashboardGallonsAvoidedEnabled: false,
        dashboardGoalProgressEnabled: false,
        weatherApiKey: "hidden-weather-key-123",
        eiaGasApiKey: "hidden-eia-key-456",
      },
    });
    await setupRideHistoryScenario(page, {
      rides: [apiKeyPrivacyRide],
    });
  });

  await recorder.step("Open history page and ensure only derived ride data is visible", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("hidden-weather-key-123")).toHaveCount(0);
    await expect(page.getByText("hidden-eia-key-456")).toHaveCount(0);
  });

  await recorder.step("Inspect DOM content and console messages for exposed key values", async () => {
    const pageContent = await page.content();
    expect(pageContent).not.toContain("hidden-weather-key-123");
    expect(pageContent).not.toContain("hidden-eia-key-456");

    const joinedConsole = consoleMessages.join("\n");
    expect(joinedConsole).not.toContain("hidden-weather-key-123");
    expect(joinedConsole).not.toContain("hidden-eia-key-456");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_keys_not_displayed_or_exposed_in_ui");
  await recorder.save(testInfo);
});
