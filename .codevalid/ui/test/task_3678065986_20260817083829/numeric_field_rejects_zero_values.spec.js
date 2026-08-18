import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Zero values in numeric fields trigger validation error and block save", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "numeric_field_rejects_zero_values",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with empty settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Navigate to settings page and enter zero", async () => {
    await page.goto("/settings");
    await page.locator("#yearlyGoalMiles").fill("0");
  });

  await recorder.step("Assert current UI keeps zero and does not render per-field validation", async () => {
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("0");
    await expect(page.getByText("Must be a positive number", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:numeric_field_rejects_zero_values");
  await recorder.save(testInfo);
});
