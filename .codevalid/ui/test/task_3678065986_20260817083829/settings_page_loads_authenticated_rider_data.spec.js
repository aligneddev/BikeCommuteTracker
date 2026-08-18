import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Authenticated rider sees their previously saved settings on page load", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "settings_page_loads_authenticated_rider_data",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated rider session and saved settings", async () => {
    await setupAppSession(page, {
      session: {
        userId: 101,
        userName: "Rider A",
        lastActivityAtUtc: "2026-08-17T08:00:00.000Z",
        expiresAtUtc: "2099-08-17T09:00:00.000Z",
      },
    });
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, {
      initialSettings: {
        averageCarMpg: 25,
        yearlyGoalMiles: 5000,
        oilChangePrice: 45,
        mileageRateCents: 12,
        locationLabel: "New York, NY",
        latitude: 40.7128,
        longitude: -74.006,
      },
    });
  });

  await recorder.step("Navigate to settings page", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Assert saved rider values are prefilled", async () => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.locator("#averageCarMpg")).toHaveValue("25");
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("5000");
    await expect(page.locator("#oilChangePrice")).toHaveValue("45");
    await expect(page.locator("#mileageRateCents")).toHaveValue("12");
    await expect(page.locator("#locationLabel")).toHaveValue("New York, NY");
    await expect(page.locator("#latitude")).toHaveValue("40.7128");
    await expect(page.locator("#longitude")).toHaveValue("-74.006");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_page_loads_authenticated_rider_data");
  await recorder.save(testInfo);
});
