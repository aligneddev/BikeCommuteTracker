import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("Settings page loads and functions fully in-browser without PWA installation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("settings_page_loads_in_browser", "Settings page loads and functions fully in-browser without PWA installation");

  await recorder.step("Seed authenticated session and local-only settings mocks");
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

  await recorder.step("Navigate directly to settings page");
  await page.goto("/settings");

  await recorder.step("Verify settings page sections render in browser mode");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import Rides from CSV" })).toBeVisible();

  await recorder.step("Interact with editable settings controls");
  await page.getByPlaceholder("Enter EIA API key to enable gas price lookup").fill("browser_mode_eia_key");
  await page.getByPlaceholder("Optional — leave blank to use free tier").fill("browser_mode_weather_key");
  await page.getByRole("button", { name: "Use Browser Location" }).click();
  await expect(page.getByText("Browser location loaded. Save settings to keep it.")).toBeVisible();

  await recorder.step("Save settings and confirm success without interruption");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("browser_mode_eia_key");
  await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toHaveValue("browser_mode_weather_key");

  console.log("CODEVALID_TEST_ASSERTION_OK:settings_page_loads_in_browser");
  await recorder.save(testInfo);
});
