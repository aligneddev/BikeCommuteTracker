import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockDashboardApis,
  mockSettingsPageData,
  mockRideHistoryExport,
} from "../../helpers/mock-api.js";

test("no_data_sent_to_cloud_storage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "no_data_sent_to_cloud_storage",
    testTitle: "No user data is transmitted to any cloud service during AppHeader interactions",
  });

  const observedRequests = [];

  await recorder.step("Seed local session and mock all app APIs", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page);

    await page.route("**/api/rides*", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ rides: [], totalMiles: 0, filteredMiles: 0 }),
        });
      }
      if (method === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ rideId: 7001, savedAtUtc: "2026-08-17T08:55:00.000Z" }),
        });
      }
      return route.fallback();
    });

    await page.route("**/api/weather*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ temperatureF: 70 }),
      });
    });

    await page.route("**", async (route) => {
      const url = route.request().url();
      observedRequests.push(url);
      return route.fallback();
    });
  });

  await recorder.step("Navigate across core routes from AppHeader", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();

    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL(/\/rides\/record$/);

    await page.getByRole("link", { name: "Ride History" }).click();
    await expect(page).toHaveURL(/\/rides\/history$/);

    await page.getByRole("button", { name: "test-rider" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  await recorder.step("Exercise local export flow and assert requests stay local", async () => {
    await page.getByRole("button", { name: "Export Ride History" }).click();

    const nonLocalRequests = observedRequests.filter((url) => {
      try {
        const parsed = new URL(url);
        return !["localhost", "127.0.0.1"].includes(parsed.hostname);
      } catch {
        return false;
      }
    });

    expect(nonLocalRequests).toEqual([]);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:no_data_sent_to_cloud_storage");
  await recorder.save(testInfo);
});
