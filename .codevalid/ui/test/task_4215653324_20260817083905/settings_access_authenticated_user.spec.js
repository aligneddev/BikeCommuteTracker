import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Authenticated rider can access Ride Preset Settings via username menu", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "settings_access_authenticated_user",
    testTitle: "Authenticated rider can access Ride Preset Settings via username menu",
  });

  await setupAuthenticatedSession(page);
  await setupAppSession(page);
  await mockCommonAppRoutes(page);

  await page.route("**/api/user-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
          weatherApiKey: null,
          eiaGasApiKey: null,
        },
      }),
    });
  });

  await page.route("**/api/rides/presets", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        presets: [],
        generatedAtUtc: "2026-08-17T08:30:00.000Z",
      }),
    });
  });

  await page.route("**/api/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totals: {
          currentMonthMiles: { miles: 0, rideCount: 0, period: "thisMonth" },
          yearToDateMiles: { miles: 0, rideCount: 0, period: "thisYear" },
          allTimeMiles: { miles: 0, rideCount: 0, period: "allTime" },
          moneySaved: { mileageRateSavings: null, fuelCostAvoided: null, qualifiedRideCount: 0 },
          expenseSummary: { totalManualExpenses: 0, oilChangeSavings: null, netExpenses: null, oilChangeIntervalCount: 0 },
        },
        averages: {
          averageTemperature: null,
          averageMilesPerRide: null,
          averageRideMinutes: null,
        },
        charts: {
          mileageByMonth: [],
          savingsByMonth: [],
        },
        suggestions: [],
        missingData: {
          ridesMissingSavingsSnapshot: 0,
          ridesMissingGasPrice: 0,
          ridesMissingTemperature: 0,
          ridesMissingDuration: 0,
        },
        generatedAtUtc: "2026-08-17T08:30:00.000Z",
      }),
    });
  });

  await recorder.recordStep("Navigate to dashboard as authenticated rider");
  await page.goto("/dashboard");

  await recorder.recordStep("Open the username menu from the header");
  await page.getByRole("button", { name: "test-rider" }).click();

  await recorder.recordStep("Choose Settings from the user menu");
  await page.getByRole("link", { name: "Settings" }).click();

  await recorder.recordStep("Verify Settings page and Ride Presets section are visible");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Preset" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_access_authenticated_user");
  await recorder.save(testInfo);
});
