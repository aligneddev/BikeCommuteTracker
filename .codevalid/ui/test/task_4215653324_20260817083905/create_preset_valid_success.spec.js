import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Valid preset creation succeeds and appears in list", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "create_preset_valid_success",
    testTitle: "Valid preset creation succeeds and appears in list",
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

  let createdPreset = null;

  await page.route("**/api/rides/presets", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presets: createdPreset ? [createdPreset] : [],
          generatedAtUtc: "2026-08-17T08:30:00.000Z",
        }),
      });
    }

    if (method === "POST") {
      const body = route.request().postDataJSON();
      createdPreset = {
        presetId: 301,
        name: body.name,
        primaryDirection: body.primaryDirection,
        periodTag: body.periodTag,
        exactStartTimeLocal: body.exactStartTimeLocal,
        durationMinutes: body.durationMinutes,
        miles: body.miles,
        lastUsedAtUtc: null,
        updatedAtUtc: "2026-08-17T08:45:00.000Z",
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createdPreset),
      });
    }

    return route.fallback();
  });

  await recorder.recordStep("Open Settings page with no presets");
  await page.goto("/settings");

  await recorder.recordStep("Fill all preset fields with valid values");
  await page.locator("#presetName").fill("Weekend Ride");
  await page.locator("#presetPeriodTag").selectOption("morning");
  await page.locator("#presetExactStartTimeLocal").fill("08:00");
  await page.locator("#presetDurationMinutes").fill("60");
  await page.locator("#presetMiles").fill("10.5");
  await page.locator("#presetPrimaryDirection").selectOption("NE");

  await recorder.recordStep("Save the preset");
  await page.getByRole("button", { name: "Add Preset" }).click();

  await recorder.recordStep("Verify success message and list entry");
  await expect(page.getByText("Preset created.")).toBeVisible();
  await expect(page.getByText("Weekend Ride (NE, morning, 08:00, 60 min, 10.5 mi)")).toBeVisible();
  await expect(page.locator("#presetName")).toHaveValue("");

  console.log("CODEVALID_TEST_ASSERTION_OK:create_preset_valid_success");
  await recorder.save(testInfo);
});
