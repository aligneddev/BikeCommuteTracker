import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("New afternoon preset creation applies NE as default direction", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "create_preset_with_afternoon_defaults",
    testTitle: "New afternoon preset creation applies NE as default direction",
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
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ presets: [], generatedAtUtc: "2026-08-17T08:30:00.000Z" }),
      });
    }
    return route.fallback();
  });

  await recorder.recordStep("Open Settings page to create a preset");
  await page.goto("/settings");

  await recorder.recordStep("Enter a preset name");
  await page.locator("#presetName").fill("Evening Ride");

  await recorder.recordStep("Select afternoon period tag");
  await page.locator("#presetPeriodTag").selectOption("afternoon");

  await recorder.recordStep("Verify default direction becomes NE");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("NE");

  console.log("CODEVALID_TEST_ASSERTION_OK:create_preset_with_afternoon_defaults");
  await recorder.save(testInfo);
});
