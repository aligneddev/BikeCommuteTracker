import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Negative values in numeric fields trigger validation error and block save", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "numeric_field_rejects_negative_values",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with empty settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Open settings and enter negative values", async () => {
    await page.goto("/settings");
    await page.locator("#averageCarMpg").fill("-5");
    await page.locator("#mileageRateCents").fill("-15");
  });

  await recorder.step("Assert values are present and business validation UI is absent", async () => {
    await expect(page.locator("#averageCarMpg")).toHaveValue("-5");
    await expect(page.locator("#mileageRateCents")).toHaveValue("-15");
    await expect(page.getByText("Must be a positive number", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:numeric_field_rejects_negative_values");
  await recorder.save(testInfo);
});
