import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockDashboardApis,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";

test("app_header_navigation_in_browser_mode", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "app_header_navigation_in_browser_mode",
    testTitle: "AppHeader allows full navigation to all core features in browser mode",
  });

  await recorder.step("Seed authenticated browser session", async () => {
    await setupAppSession(page);
  });

  await recorder.step("Mock common app, dashboard, settings, and ride page APIs", async () => {
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page);
    await mockSettingsPageData(page);

    await page.route("**/api/rides*", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            rides: [],
            totalMiles: 0,
            filteredMiles: 0,
          }),
        });
      }
      if (method === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            rideId: 501,
            savedAtUtc: "2026-08-17T08:30:00.000Z",
          }),
        });
      }
      return route.fallback();
    });

    await page.route("**/api/weather*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ temperatureF: 68 }),
      });
    });
  });

  await recorder.step("Open dashboard in browser mode", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Browser Mode" })).toBeVisible();
  });

  await recorder.step("Navigate to Record Ride from AppHeader", async () => {
    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL(/\/rides\/record$/);
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Navigate to Ride History from AppHeader", async () => {
    await page.getByRole("link", { name: "Ride History" }).click();
    await expect(page).toHaveURL(/\/rides\/history$/);
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
  });

  await recorder.step("Navigate to Dashboard from AppHeader", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
  });

  await recorder.step("Open the user menu and navigate to Settings", async () => {
    await page.getByRole("button", { name: "test-rider" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:app_header_navigation_in_browser_mode");
  await recorder.save(testInfo);
});
