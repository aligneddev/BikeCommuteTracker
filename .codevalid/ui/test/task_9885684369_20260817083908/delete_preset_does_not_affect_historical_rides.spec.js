import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Deleting a preset removes it from the list but does not affect historical rides", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("delete_preset_does_not_affect_historical_rides", "Deleting a preset removes it from the list but does not affect historical rides");

  const initialPresets = [
    {
      presetId: 41,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:45",
      durationMinutes: 30,
      miles: 8.5,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:00:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets });
  await page.route("**/api/rides/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summaries: {
          thisMonth: { miles: 25.5, rideCount: 3, period: "thisMonth" },
          thisYear: { miles: 25.5, rideCount: 3, period: "thisYear" },
          allTime: { miles: 25.5, rideCount: 3, period: "allTime" },
        },
        filteredTotal: { miles: 25.5, rideCount: 3, period: "filtered" },
        rides: [
          {
            rideId: 501,
            rideDateTimeLocal: "2026-08-16T07:45",
            miles: 8.5,
            rideMinutes: 30,
            primaryTravelDirection: "SW",
            note: "Recorded from Commute Home preset",
          },
          {
            rideId: 502,
            rideDateTimeLocal: "2026-08-17T07:45",
            miles: 8.5,
            rideMinutes: 30,
            primaryTravelDirection: "SW",
            note: "Recorded from Commute Home preset",
          },
          {
            rideId: 503,
            rideDateTimeLocal: "2026-08-18T07:45",
            miles: 8.5,
            rideMinutes: 30,
            primaryTravelDirection: "SW",
            note: "Recorded from Commute Home preset",
          },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 3,
      }),
    });
  });

  await recorder.step("Delete the preset from Settings");
  await page.goto("/settings");
  const presetItem = page.locator(".settings-presets-item").filter({ hasText: "Commute Home" });
  await presetItem.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Preset deleted.")).toBeVisible();
  await expect(page.getByText("Commute Home (SW, morning, 07:45, 30 min, 8.5 mi)")).toHaveCount(0);

  await recorder.step("Navigate to Ride History and verify historical rides are still present");
  await page.getByRole("link", { name: "Ride History" }).click();
  await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
  await expect(page.getByText("Recorded from Commute Home preset")).toHaveCount(3);
  await expect(page.getByText("8.5")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:delete_preset_does_not_affect_historical_rides");
  await recorder.save(testInfo);
});
