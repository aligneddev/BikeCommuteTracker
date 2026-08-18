import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Rider sees only their own presets on SettingsPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("preset_list_loads_per_rider", "Rider sees only their own presets on SettingsPage");

  const riderPresets = [
    {
      presetId: 11,
      name: "Commute Home",
      primaryDirection: "SW",
      periodTag: "morning",
      exactStartTimeLocal: "07:45",
      durationMinutes: 30,
      miles: 8.5,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:00:00Z",
    },
    {
      presetId: 12,
      name: "Gym Trip",
      primaryDirection: "NW",
      periodTag: "afternoon",
      exactStartTimeLocal: "17:30",
      durationMinutes: 25,
      miles: 5.2,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:05:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and preset-management mocks");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets: riderPresets });

  await recorder.step("Open the username menu");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "johndoe" }).click();

  await recorder.step("Navigate to Settings and verify Ride Presets list");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();

  const presetItems = page.locator(".settings-presets-list .settings-presets-item");
  await expect(presetItems).toHaveCount(2);
  await expect(presetItems.nth(0)).toContainText("Commute Home");
  await expect(presetItems.nth(1)).toContainText("Gym Trip");
  await expect(page.getByText("Commute Home (SW, morning, 07:45, 30 min, 8.5 mi)")).toBeVisible();
  await expect(page.getByText("Gym Trip (NW, afternoon, 17:30, 25 min, 5.2 mi)")).toBeVisible();
  await expect(page.getByText("Other Rider Preset")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_list_loads_per_rider");
  await recorder.save(testInfo);
});
