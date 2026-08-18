import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("EIA Gas Price API key is saved locally and not transmitted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("eia_api_key_saved_locally", "EIA Gas Price API key is saved locally and not transmitted");

  await recorder.step("Seed authenticated session and local settings persistence mock");
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

  await recorder.step("Open settings page and enter EIA key");
  await page.goto("/settings");
  await page.getByPlaceholder("Enter EIA API key to enable gas price lookup").fill("mock_eia_key_123");

  await recorder.step("Save settings and reload page");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved successfully.")).toBeVisible();
  await page.reload();

  await recorder.step("Verify EIA key persists locally after reload and no external traffic occurred");
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toHaveValue("mock_eia_key_123");
  expect(externalRequests, "No external requests should be made while saving local settings").toEqual([]);

  console.log("CODEVALID_TEST_ASSERTION_OK:eia_api_key_saved_locally");
  await recorder.save(testInfo);
});
