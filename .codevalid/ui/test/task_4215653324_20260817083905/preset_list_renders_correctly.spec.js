import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Preset list displays all user-specific presets with correct metadata", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "preset_list_renders_correctly",
    testTitle: "Preset list displays all user-specific presets with correct metadata",
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
        presets: [
          {
            presetId: 101,
            name: "Morning Commute",
            primaryDirection: "SW",
            periodTag: "morning",
            exactStartTimeLocal: "07:00",
            durationMinutes: 30,
            miles: 5.2,
            lastUsedAtUtc: null,
            updatedAtUtc: "2026-08-17T08:30:00.000Z",
          },
          {
            presetId: 102,
            name: "Afternoon Run",
            primaryDirection: "NE",
            periodTag: "afternoon",
            exactStartTimeLocal: "17:30",
            durationMinutes: 45,
            miles: 6.1,
            lastUsedAtUtc: null,
            updatedAtUtc: "2026-08-17T08:35:00.000Z",
          },
        ],
        generatedAtUtc: "2026-08-17T08:40:00.000Z",
      }),
    });
  });

  await recorder.recordStep("Navigate directly to Settings page");
  await page.goto("/settings");

  await recorder.recordStep("Verify Ride Presets section renders returned presets");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await expect(page.getByText("Morning Commute (SW, morning, 07:00, 30 min, 5.2 mi)")).toBeVisible();
  await expect(page.getByText("Afternoon Run (NE, afternoon, 17:30, 45 min, 6.1 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_list_renders_correctly");
  await recorder.save(testInfo);
});
