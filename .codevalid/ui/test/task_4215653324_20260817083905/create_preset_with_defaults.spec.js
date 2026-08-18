import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("New preset creation applies default direction based on period tag", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "create_preset_with_defaults",
    testTitle: "New preset creation applies default direction based on period tag",
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
  await page.locator("#presetName").fill("Workday Morning");

  await recorder.recordStep("Select morning period tag");
  await page.locator("#presetPeriodTag").selectOption("morning");

  await recorder.recordStep("Verify default direction becomes SW");
  await expect(page.locator("#presetPrimaryDirection")).toHaveValue("SW");

  console.log("CODEVALID_TEST_ASSERTION_OK:create_preset_with_defaults");
  await recorder.save(testInfo);
});
