import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("User selects location but does not save — location is not stored", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "location_picker_select_but_do_not_save",
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

  await recorder.step("Load settings and modify location without saving", async () => {
    await page.goto("/settings");
    await expect(page.locator("#locationLabel")).toHaveValue("Home, Seattle, WA");
    await page.locator("#locationLabel").fill("Times Square, New York, NY");
    await page.locator("#latitude").fill("40.758");
    await page.locator("#longitude").fill("-73.9855");
  });

  await recorder.step("Navigate away and return without save", async () => {
    await page.goto("/dashboard");
    await page.goto("/settings");
  });

  await recorder.step("Assert original saved location remains", async () => {
    await expect(page.locator("#locationLabel")).toHaveValue("Home, Seattle, WA");
    await expect(page.locator("#latitude")).toHaveValue("47.6062");
    await expect(page.locator("#longitude")).toHaveValue("-122.3321");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:location_picker_select_but_do_not_save");
  await recorder.save(testInfo);
});
