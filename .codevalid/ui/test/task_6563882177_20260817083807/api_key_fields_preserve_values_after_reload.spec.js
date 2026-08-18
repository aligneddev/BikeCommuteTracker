import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("API key fields retain their values after browser refresh or tab reload", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("api_key_fields_preserve_values_after_reload", "API key fields retain their values after browser refresh or tab reload");

  await recorder.step("Seed authenticated session and persistent local settings mock");
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
  await blockExternalNetwork(page);

  await recorder.step("Enter both API keys and save");
  await page.goto("/settings");
  await page.getByPlaceholder("Enter EIA API key to enable gas price lookup").fill("retain_eia_key");
  await page.getByPlaceholder("Optional — leave blank to use free tier").fill("retain_weather_key");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();

  await recorder.step("Refresh browser and reopen settings route");
  await page.reload();
  await page.goto("/settings");

  await recorder.step("Verify both API key fields remain populated after reload");
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("retain_eia_key");
  await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toHaveValue("retain_weather_key");

  console.log("CODEVALID_TEST_ASSERTION_OK:api_key_fields_preserve_values_after_reload");
  await recorder.save(testInfo);
});
