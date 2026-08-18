import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Editing preset with unchanged name succeeds", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "edit_preset_same_name_no_change",
    testTitle: "Editing preset with unchanged name succeeds",
  });

  await setupAuthenticatedSession(page);
  await setupAppSession(page);
  await mockCommonAppRoutes(page);

  let presetsState = [
    {
      presetId: 401,
      name: "Daily Commute",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:00",
      durationMinutes: 30,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-17T08:30:00.000Z",
    },
  ];

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
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === "GET" && url.pathname.endsWith("/api/rides/presets")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presets: presetsState,
          generatedAtUtc: "2026-08-17T08:30:00.000Z",
        }),
      });
    }

    if (method === "PUT") {
      const body = route.request().postDataJSON();
      const presetId = Number(url.pathname.split("/").pop());
      presetsState = presetsState.map((preset) =>
        preset.presetId === presetId
          ? {
              ...preset,
              name: body.name,
              primaryDirection: body.primaryDirection,
              periodTag: body.periodTag,
              exactStartTimeLocal: body.exactStartTimeLocal,
              durationMinutes: body.durationMinutes,
              miles: body.miles,
              updatedAtUtc: "2026-08-17T08:45:00.000Z",
            }
          : preset
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(presetsState[0]),
      });
    }

    return route.fallback();
  });

  await recorder.recordStep("Open Settings page with an existing preset");
  await page.goto("/settings");

  await recorder.recordStep("Enter edit mode for Daily Commute");
  await page.getByRole("button", { name: "Edit" }).click();

  await recorder.recordStep("Change duration and miles without changing the name");
  await expect(page.locator("#presetName")).toHaveValue("Daily Commute");
  await page.locator("#presetDurationMinutes").fill("45");
  await page.locator("#presetMiles").fill("6");

  await recorder.recordStep("Save updated preset");
  await page.getByRole("button", { name: "Save Preset" }).click();

  await recorder.recordStep("Verify updated values are shown and success message appears");
  await expect(page.getByText("Preset updated.")).toBeVisible();
  await expect(page.getByText("Daily Commute (SW, morning, 07:00, 45 min, 6 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_preset_same_name_no_change");
  await recorder.save(testInfo);
});
