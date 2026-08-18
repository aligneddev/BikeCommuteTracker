import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("User unsets location by clearing the field and saving — location is removed from profile", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "settings_page_unsets_location_by_clearing",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with existing location", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, {
      initialSettings: {
        locationLabel: "Home, Seattle, WA",
        latitude: 47.6062,
        longitude: -122.3321,
      },
    });
  });

  await recorder.step("Clear manual location fields and save", async () => {
    await page.goto("/settings");
    await page.locator("#locationLabel").fill("");
    await page.locator("#latitude").fill("");
    await page.locator("#longitude").fill("");
    await page.getByRole("button", { name: "Save Settings" }).click();
  });

  await recorder.step("Assert location is removed after reload", async () => {
    await expect(page.getByText("Settings saved successfully.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#locationLabel")).toHaveValue("");
    await expect(page.locator("#latitude")).toHaveValue("");
    await expect(page.locator("#longitude")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_page_unsets_location_by_clearing");
  await recorder.save(testInfo);
});
