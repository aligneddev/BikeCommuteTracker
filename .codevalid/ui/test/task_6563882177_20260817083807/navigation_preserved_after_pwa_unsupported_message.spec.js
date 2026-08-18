import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockDashboardApis,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";

test("navigation_preserved_after_pwa_unsupported_message", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "navigation_preserved_after_pwa_unsupported_message",
    testTitle: "AppHeader navigation continues to respond to user clicks after PWA guidance is shown",
  });

  await recorder.step("Seed session and mocks for dashboard, history, and settings", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page);
    await mockSettingsPageData(page);

    await page.route("**/api/rides*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: [], totalMiles: 0, filteredMiles: 0 }),
      });
    });
  });

  await recorder.step("Open settings and confirm unsupported guidance is visible", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
    await expect(page.getByText("Continue using browser mode.")).toBeVisible();
  });

  await recorder.step("Navigate to Dashboard after guidance is shown", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
  });

  await recorder.step("Navigate to Ride History after guidance is shown", async () => {
    await page.getByRole("link", { name: "Ride History" }).click();
    await expect(page).toHaveURL(/\/rides\/history$/);
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
  });

  await recorder.step("Use the user menu to return to Settings", async () => {
    await page.getByRole("button", { name: "test-rider" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Continue using browser mode.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:navigation_preserved_after_pwa_unsupported_message");
  await recorder.save(testInfo);
});
