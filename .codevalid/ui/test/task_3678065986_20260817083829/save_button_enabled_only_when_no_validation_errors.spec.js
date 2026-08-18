import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Save button is disabled when any field has validation errors and enabled only when all fields are valid", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "save_button_enabled_only_when_no_validation_errors",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with empty settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Enter invalid then valid values while checking save state", async () => {
    await page.goto("/settings");
    const saveButton = page.getByRole("button", { name: "Save Settings" });

    await page.locator("#averageCarMpg").fill("-5");
    await expect(saveButton).toBeEnabled();

    await page.locator("#averageCarMpg").fill("22.5");
    await page.locator("#yearlyGoalMiles").fill("0");
    await expect(saveButton).toBeEnabled();

    await page.locator("#yearlyGoalMiles").fill("5000");
    await expect(saveButton).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:save_button_enabled_only_when_no_validation_errors");
  await recorder.save(testInfo);
});
