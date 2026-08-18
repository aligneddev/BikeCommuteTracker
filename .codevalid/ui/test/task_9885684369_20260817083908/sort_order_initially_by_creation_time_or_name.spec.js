import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Preset list is initially sorted by creation time or name", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("sort_order_initially_by_creation_time_or_name", "Preset list is initially sorted by creation time or name");

  const initialPresets = [
    {
      presetId: 61,
      name: "Beach Trip",
      primaryDirection: "SE",
      periodTag: "morning",
      exactStartTimeLocal: "08:00",
      durationMinutes: 40,
      miles: 12.3,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T10:00:00Z",
    },
    {
      presetId: 62,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:45",
      durationMinutes: 30,
      miles: 8.5,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T10:05:00Z",
    },
    {
      presetId: 63,
      name: "Gym Trip",
      primaryDirection: "NW",
      periodTag: "afternoon",
      exactStartTimeLocal: "17:30",
      durationMinutes: 25,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T10:10:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and an ordered preset list");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets });

  await recorder.step("Open Settings and inspect the initial preset ordering");
  await page.goto("/settings");
  const items = page.locator(".settings-presets-list .settings-presets-item span");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Beach Trip");
  await expect(items.nth(1)).toContainText("Commute Home");
  await expect(items.nth(2)).toContainText("Gym Trip");

  console.log("CODEVALID_TEST_ASSERTION_OK:sort_order_initially_by_creation_time_or_name");
  await recorder.save(testInfo);
});
