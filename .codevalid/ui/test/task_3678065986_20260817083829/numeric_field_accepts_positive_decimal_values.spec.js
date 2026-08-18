import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Positive decimal values in numeric fields are accepted and saved", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "numeric_field_accepts_positive_decimal_values",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with empty settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Enter valid decimal values and save", async () => {
    await page.goto("/settings");
    await page.locator("#averageCarMpg").fill("22.5");
    await page.locator("#mileageRateCents").fill("12.75");
    await page.locator("#oilChangePrice").fill("45.50");
    await page.getByRole("button", { name: "Save Settings" }).click();
  });

  await recorder.step("Assert success and values persist after reload", async () => {
    await expect(page.getByText("Settings saved successfully.")).toBeVisible();
    await expect(page.locator("#averageCarMpg")).toHaveValue("22.5");
    await expect(page.locator("#mileageRateCents")).toHaveValue("12.75");
    await expect(page.locator("#oilChangePrice")).toHaveValue("45.5");

    await page.reload();

    await expect(page.locator("#averageCarMpg")).toHaveValue("22.5");
    await expect(page.locator("#mileageRateCents")).toHaveValue("12.75");
    await expect(page.locator("#oilChangePrice")).toHaveValue("45.5");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:numeric_field_accepts_positive_decimal_values");
  await recorder.save(testInfo);
});
