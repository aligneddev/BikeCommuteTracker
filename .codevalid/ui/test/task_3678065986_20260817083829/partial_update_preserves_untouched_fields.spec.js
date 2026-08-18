import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Partial update saves only modified fields and preserves unchanged values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "partial_update_preserves_untouched_fields",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider with existing settings", async () => {
    await setupAppSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, {
      initialSettings: {
        averageCarMpg: 25,
        yearlyGoalMiles: 5000,
        oilChangePrice: 45,
        mileageRateCents: 12,
        locationLabel: "Home, Seattle, WA",
        latitude: 47.6062,
        longitude: -122.3321,
      },
    });
  });

  await recorder.step("Change only mileage rate and save", async () => {
    await page.goto("/settings");
    await page.locator("#mileageRateCents").fill("15");
    await page.getByRole("button", { name: "Save Settings" }).click();
  });

  await recorder.step("Assert untouched fields are preserved after reload", async () => {
    await expect(page.getByText("Settings saved successfully.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#averageCarMpg")).toHaveValue("25");
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("5000");
    await expect(page.locator("#oilChangePrice")).toHaveValue("45");
    await expect(page.locator("#mileageRateCents")).toHaveValue("15");
    await expect(page.locator("#locationLabel")).toHaveValue("Home, Seattle, WA");
    await expect(page.locator("#latitude")).toHaveValue("47.6062");
    await expect(page.locator("#longitude")).toHaveValue("-122.3321");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:partial_update_preserves_untouched_fields");
  await recorder.save(testInfo);
});
