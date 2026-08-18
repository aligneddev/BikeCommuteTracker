import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockDashboardApis,
  mockSettingsPageData,
  mockRideHistoryExport,
} from "../../helpers/mock-api.js";

test("core_features_accessible_without_pwa_installation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "core_features_accessible_without_pwa_installation",
    testTitle: "All core features remain functional regardless of PWA installation status",
  });

  await recorder.step("Seed authenticated session and local API mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page);
    await mockRideHistoryExport(page);
    await mockSettingsPageData(page, {
      settings: {
        averageCarMpg: null,
        yearlyGoalMiles: 1500,
        oilChangePrice: null,
        mileageRateCents: null,
        locationLabel: null,
        latitude: null,
        longitude: null,
        dashboardGallonsAvoidedEnabled: false,
        dashboardGoalProgressEnabled: true,
        weatherApiKey: "weather-local-key",
        eiaGasApiKey: "eia-local-key",
      },
    });

    let rides = [
      {
        rideId: 900,
        rideDate: "2026-08-15",
        rideDateTimeLocal: "2026-08-15T08:00",
        miles: 6.5,
        startTimeLocal: "08:00",
        note: "Earlier commute",
      },
    ];

    await page.route("**/api/rides*", async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());

      if (method === "GET" && url.pathname.includes("/api/rides")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            rides,
            totalMiles: rides.reduce((sum, ride) => sum + (ride.miles ?? 0), 0),
            filteredMiles: rides.reduce((sum, ride) => sum + (ride.miles ?? 0), 0),
          }),
        });
      }

      if (method === "POST" && url.pathname.includes("/api/rides")) {
        const body = route.request().postDataJSON();
        const nextRide = {
          rideId: 901,
          rideDate: body.rideDate ?? "2026-08-17",
          rideDateTimeLocal: body.rideDateTimeLocal ?? "2026-08-17T08:30",
          miles: Number(body.miles ?? 8.2),
          note: body.note ?? "Browser mode commute",
        };
        rides = [nextRide, ...rides];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(nextRide),
        });
      }

      return route.fallback();
    });

    await page.route("**/api/weather*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          temperatureF: 72,
          windSpeedMph: 5,
          windDirectionDeg: 180,
          relativeHumidityPercent: 45,
          cloudCoverPercent: 20,
          precipitationType: "none",
        }),
      });
    });

    await page.route("**/api/ride-imports**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: 3001,
            fileName: "rides.csv",
            totalRows: 1,
            validRows: 1,
            invalidRows: 0,
            duplicateCount: 0,
            canConfirmImport: true,
            duplicates: [],
            errors: [],
          }),
        });
      }
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: 3001,
            status: "completed",
            totalRows: 1,
            validRows: 1,
            invalidRows: 0,
            duplicateCount: 0,
            summary: {
              totalRows: 1,
              importedRows: 1,
              skippedRows: 0,
              failedRows: 0,
            },
          }),
        });
      }
      return route.fallback();
    });
  });

  await recorder.step("Record flow remains available in browser mode", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Browser Mode" })).toBeVisible();
  });

  await recorder.step("Ride history remains available without installation", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("Earlier commute")).toBeVisible();
  });

  await recorder.step("Dashboard remains available without installation", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Miles by Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings by Month" })).toBeVisible();
  });

  await recorder.step("Settings preserve and display per-rider API key fields", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("eia-local-key");
    await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toHaveValue("weather-local-key");
  });

  await recorder.step("Import and export features remain accessible", async () => {
    await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
    await page.getByRole("button", { name: "Export Ride History" }).click();
    await page.getByRole("link", { name: "Import Rides from CSV" }).click();
    await expect(page).toHaveURL(/\/rides\/import$/);
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:core_features_accessible_without_pwa_installation");
  await recorder.save(testInfo);
});
