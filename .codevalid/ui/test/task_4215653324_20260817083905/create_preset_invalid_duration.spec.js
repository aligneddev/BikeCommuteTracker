import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Preset creation fails with non-positive duration", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "create_preset_invalid_duration",
    testTitle: "Preset creation fails with non-positive duration",
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

  await recorder.recordStep("Open Settings page");
  await page.goto("/settings");

  await recorder.recordStep("Fill valid fields except duration");
  await page.locator("#presetName").fill("Lunch Loop");
  await page.locator("#presetPeriodTag").selectOption("morning");
  await page.locator("#presetExactStartTimeLocal").fill("08:00");
  await page.locator("#presetMiles").fill("5.2");

  await recorder.recordStep("Enter zero duration and submit");
  await page.locator("#presetDurationMinutes").fill("0");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.recordStep("Verify duration validation message is visible");
  await expect(page.getByRole("alert")).toContainText("Duration minutes must be greater than 0.");

  console.log("CODEVALID_TEST_ASSERTION_OK:create_preset_invalid_duration");
  await recorder.save(testInfo);
});
