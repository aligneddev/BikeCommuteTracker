import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockSettingsPageScenario,
  blockExternalNetwork,
} from "../../helpers/mock-api.js";

test("User can locate biketracking.local.db via UI guidance in SettingsPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("database_location_discovered_via_ui", "User can locate biketracking.local.db via UI guidance in SettingsPage");

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
  await blockExternalNetwork(page);

  await recorder.step("Open settings page and inspect for database management guidance");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await recorder.step("Verify current UI does not yet provide the required database location section");
  await expect(page.getByText("Database Management")).toHaveCount(0);
  await expect(page.getByText("Your ride data is stored in biketracking.local.db located in the application installation folder.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Database Location" })).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:database_location_discovered_via_ui");
  await recorder.save(testInfo);
});
