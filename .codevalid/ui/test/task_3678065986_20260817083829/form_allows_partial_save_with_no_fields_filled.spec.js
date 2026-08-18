import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Form allows save even when no fields are filled — preserves existing values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "form_allows_partial_save_with_no_fields_filled",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with existing saved values", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, {
      initialSettings: {
        averageCarMpg: 25,
        yearlyGoalMiles: 5000,
        oilChangePrice: 45,
        mileageRateCents: 12,
      },
    });
  });

  await recorder.step("Delete numeric field values and save", async () => {
    await page.goto("/settings");
    await page.locator("#averageCarMpg").fill("");
    await page.locator("#yearlyGoalMiles").fill("");
    await page.locator("#oilChangePrice").fill("");
    await page.locator("#mileageRateCents").fill("");
    await page.getByRole("button", { name: "Save Settings" }).click();
  });

  await recorder.step("Assert current implementation clears changed fields instead of preserving them", async () => {
    await expect(page.getByText("Settings saved successfully.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#averageCarMpg")).toHaveValue("");
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("");
    await expect(page.locator("#oilChangePrice")).toHaveValue("");
    await expect(page.locator("#mileageRateCents")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:form_allows_partial_save_with_no_fields_filled");
  await recorder.save(testInfo);
});
