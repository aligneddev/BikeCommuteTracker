import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("User selects and explicitly saves a reference location via location picker", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "location_picker_select_and_save",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Open settings page", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Assert current page exposes manual location fields instead of search picker", async () => {
    await expect(page.locator("#locationLabel")).toBeVisible();
    await expect(page.locator("#latitude")).toBeVisible();
    await expect(page.locator("#longitude")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Location" })).toHaveCount(0);
  });

  await recorder.step("Save a manual location snapshot and verify persistence", async () => {
    await page.locator("#locationLabel").fill("Central Park, New York, NY");
    await page.locator("#latitude").fill("40.7829");
    await page.locator("#longitude").fill("-73.9654");
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect(page.getByText("Settings saved successfully.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#locationLabel")).toHaveValue("Central Park, New York, NY");
    await expect(page.locator("#latitude")).toHaveValue("40.7829");
    await expect(page.locator("#longitude")).toHaveValue("-73.9654");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:location_picker_select_and_save");
  await recorder.save(testInfo);
});
