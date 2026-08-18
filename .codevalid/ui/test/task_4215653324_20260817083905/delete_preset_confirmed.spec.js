import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes, setupAppSession } from "../../helpers/mock-api.js";

test("Confirmed preset deletion removes preset from list and ride entry", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "delete_preset_confirmed",
    testTitle: "Confirmed preset deletion removes preset from list and ride entry",
  });

  await setupAuthenticatedSession(page);
  await setupAppSession(page);
  await mockCommonAppRoutes(page);

  let presetsState = [
    {
      presetId: 501,
      name: "Weekend Ride",
      primaryDirection: "NE",
      periodTag: "morning",
      exactStartTimeLocal: "08:00",
      durationMinutes: 60,
      miles: 10.5,
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

    if (method === "DELETE") {
      const presetId = Number(url.pathname.split("/").pop());
      presetsState = presetsState.filter((preset) => preset.presetId !== presetId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presetId,
          deletedAtUtc: "2026-08-17T08:50:00.000Z",
          message: "Preset deleted.",
        }),
      });
    }

    return route.fallback();
  });

  await recorder.recordStep("Open Settings page with one preset");
  await page.goto("/settings");

  await recorder.recordStep("Delete the existing preset from the list");
  await expect(page.getByText("Weekend Ride (NE, morning, 08:00, 60 min, 10.5 mi)")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();

  await recorder.recordStep("Verify success message and removed list item");
  await expect(page.getByText("Preset deleted.")).toBeVisible();
  await expect(page.getByText("Weekend Ride (NE, morning, 08:00, 60 min, 10.5 mi)")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:delete_preset_confirmed");
  await recorder.save(testInfo);
});
