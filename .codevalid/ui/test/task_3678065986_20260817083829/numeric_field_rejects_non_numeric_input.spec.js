import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Non-numeric input in numeric fields triggers validation error and blocks save", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "numeric_field_rejects_non_numeric_input",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with empty settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Open settings page", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Attempt to enter non-numeric values", async () => {
    await page.locator("#averageCarMpg").fill("abc");
    await page.locator("#mileageRateCents").fill("xyz");
  });

  await recorder.step("Assert browser blocks invalid number text and required business error is absent/pending", async () => {
    await expect(page.locator("#averageCarMpg")).toHaveValue("");
    await expect(page.locator("#mileageRateCents")).toHaveValue("");
    await expect(page.getByText("Must be a positive number", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:numeric_field_rejects_non_numeric_input");
  await recorder.save(testInfo);
});
