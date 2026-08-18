import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  setupSettingsScenario,
  setupSettingsSupportRoutes,
} from "../../helpers/mock-api.js";

test("Unauthenticated user is blocked from accessing SettingsPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "settings_page_unauthenticated_access_blocked",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange unauthenticated session and support routes", async () => {
    await setupUnauthenticatedSession(page);
    await setupSettingsSupportRoutes(page);
    await setupSettingsScenario(page, { initialSettings: {} });
  });

  await recorder.step("Navigate to /settings", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Assert redirect to login and no settings UI", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Settings" })).toHaveCount(0);
    await expect(page.locator("#averageCarMpg")).toHaveCount(0);
    await expect(page.locator("#locationLabel")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_page_unauthenticated_access_blocked");
  await recorder.save(testInfo);
});
