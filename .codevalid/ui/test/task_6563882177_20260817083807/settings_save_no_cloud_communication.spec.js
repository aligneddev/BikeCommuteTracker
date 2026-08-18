import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("Saving any setting in SettingsPage triggers no cloud network calls", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("settings_save_no_cloud_communication", "Saving any setting in SettingsPage triggers no cloud network calls");

  await recorder.step("Seed authenticated session and local settings scenario");
  await setupAuthenticatedSession(page, {
    token: "mock-valid-token",
    user: {
      userId: 1,
      userName: "John Doe",
      lastActivityAtUtc: "2099-01-01T00:00:00.000Z",
      expiresAtUtc: "2099-01-08T00:00:00.000Z",
    },
  });
  await mockSettingsPageScenario(page);
  const externalRequests = await blockExternalNetwork(page);

  await recorder.step("Modify multiple settings values");
  await page.goto("/settings");
  await page.locator("#averageCarMpg").fill("32.5");
  await page.locator("#yearlyGoalMiles").fill("1500");
  await page.getByPlaceholder("Enter EIA API key to enable gas price lookup").fill("no_cloud_eia_key");
  await page.getByPlaceholder("Optional — leave blank to use free tier").fill("no_cloud_weather_key");

  await recorder.step("Save settings and verify local success");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();
  await expect(page.locator("#averageCarMpg")).toHaveValue("32.5");
  await expect(page.locator("#yearlyGoalMiles")).toHaveValue("1500");
  expect(externalRequests, "No cloud requests should occur when saving settings").toEqual([]);

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_save_no_cloud_communication");
  await recorder.save(testInfo);
});
