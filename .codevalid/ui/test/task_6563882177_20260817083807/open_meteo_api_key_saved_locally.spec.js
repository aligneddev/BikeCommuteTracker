import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("Open-Meteo Weather API key is saved locally and not transmitted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("open_meteo_api_key_saved_locally", "Open-Meteo Weather API key is saved locally and not transmitted");

  await recorder.step("Seed authenticated session and settings mocks");
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

  await recorder.step("Open settings page and enter Open-Meteo key");
  await page.goto("/settings");
  await page.getByPlaceholder("Optional — leave blank to use free tier").fill("mock_open_meteo_key_456");

  await recorder.step("Save then reload to validate persistence");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();
  await page.reload();

  await recorder.step("Verify Open-Meteo key remains populated and no external requests occurred");
  await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toHaveValue("mock_open_meteo_key_456");
  expect(externalRequests, "No external requests should be made while saving weather API key").toEqual([]);

  console.log("CODEVALID_TEST_ASSERTION_OK:open_meteo_api_key_saved_locally");
  await recorder.save(testInfo);
});
