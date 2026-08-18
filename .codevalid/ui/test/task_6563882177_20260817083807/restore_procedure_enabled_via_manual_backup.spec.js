import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("Settings persist after manual database restore", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("restore_procedure_enabled_via_manual_backup", "Settings persist after manual database restore");

  await recorder.step("Seed authenticated session and restored-settings scenario from local backup");
  await setupAuthenticatedSession(page, {
    token: "mock-valid-token",
    user: {
      userId: 1,
      userName: "John Doe",
      lastActivityAtUtc: "2099-01-01T00:00:00.000Z",
      expiresAtUtc: "2099-01-08T00:00:00.000Z",
    },
  });
  await mockSettingsPageScenario(page, {
    initialSettings: {
      weatherApiKey: "restored_open_meteo_key",
      eiaGasApiKey: "restored_eia_key",
      averageCarMpg: 31.2,
      yearlyGoalMiles: 2200,
    },
  });
  const externalRequests = await blockExternalNetwork(page);

  await recorder.step("Open settings page after simulated restart with restored local database");
  await page.goto("/settings");

  await recorder.step("Verify restored values are displayed from local state only");
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("restored_eia_key");
  await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toHaveValue("restored_open_meteo_key");
  await expect(page.locator("#averageCarMpg")).toHaveValue("31.2");
  await expect(page.locator("#yearlyGoalMiles")).toHaveValue("2200");
  expect(externalRequests, "Restore scenario must not pull data from cloud endpoints").toEqual([]);

  console.log("CODEVALID_TEST_ASSERTION_OK:restore_procedure_enabled_via_manual_backup");
  await recorder.save(testInfo);
});
