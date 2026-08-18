import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupPresetManagementScenario,
  setupHealthyStartupGuard,
} from "../../helpers/mock-api.js";

test("Ride presets persist across page reloads and are reloaded on revisit", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("presets_persist_on_page_reload", "Ride presets persist across page reloads and are reloaded on revisit");

  const initialPresets = [
    {
      presetId: 51,
      name: "Evening Run",
      primaryDirection: "NE",
      periodTag: "afternoon",
      exactStartTimeLocal: "18:15",
      durationMinutes: 35,
      miles: 9.4,
      lastUsedAtUtc: null,
      updatedAtUtc: "2026-08-18T12:00:00Z",
    },
  ];

  await recorder.step("Set authenticated rider session and preset-management mocks with a saved preset");
  await setupAuthenticatedSession(page);
  await setupHealthyStartupGuard(page);
  await setupPresetManagementScenario(page, { initialPresets });

  await recorder.step("Visit Settings, navigate away, and revisit the page");
  await page.goto("/settings");
  await expect(page.getByText("Evening Run (NE, afternoon, 18:15, 35 min, 9.4 mi)")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/settings");

  await recorder.step("Verify the preset is reloaded after revisiting");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await expect(page.getByText("Evening Run (NE, afternoon, 18:15, 35 min, 9.4 mi)")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:presets_persist_on_page_reload");
  await recorder.save(testInfo);
});
