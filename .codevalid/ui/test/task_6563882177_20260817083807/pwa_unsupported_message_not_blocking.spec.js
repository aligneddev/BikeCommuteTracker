import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
  mockUnsupportedPwaEnvironment,
} from "../../helpers/mock-api.js";

test("PWA unsupported guidance does not block access to SettingsPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("pwa_unsupported_message_not_blocking", "PWA unsupported guidance does not block access to SettingsPage");

  await recorder.step("Seed authenticated session, unsupported PWA environment, and local settings mocks");
  await setupAuthenticatedSession(page, {
    token: "mock-valid-token",
    user: {
      userId: 1,
      userName: "John Doe",
      lastActivityAtUtc: "2099-01-01T00:00:00.000Z",
      expiresAtUtc: "2099-01-08T00:00:00.000Z",
    },
  });
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_browser" });
  await mockSettingsPageScenario(page);
  await blockExternalNetwork(page);

  await recorder.step("Open settings page and verify unsupported-install guidance is shown");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  await expect(page.getByText("Installation is not available in this browser in v1. Use current Chrome or Edge on Windows, or continue using browser mode.")).toBeVisible();

  await recorder.step("Modify and save a setting despite unsupported install environment");
  await page.getByPlaceholder("Enter EIA API key to enable gas price lookup").fill("still_works_in_browser");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("still_works_in_browser");

  console.log("CODEVALID_TEST_ASSERTION_OK:pwa_unsupported_message_not_blocking");
  await recorder.save(testInfo);
});
