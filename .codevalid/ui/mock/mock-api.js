/**
 * Playwright route helpers for CodeValid task tests.
 *
 * The mock API server (mock-api-server.js) already handles all HTTP calls
 * at the network level (started by playwright.config.js webServer).
 * These helpers are available for task tests that need to override specific
 * endpoint responses within a single test (e.g. simulate a 401 or 429).
 *
 * Usage in a task test:
 *   import { overrideLogin } from "../../mock/mock-api.js";
 *   test.beforeEach(async ({ page }) => { await overrideLogin(page, { fail: true }); });
 */

/**
 * Override the login endpoint for a single test.
 * @param {import('@playwright/test').Page} page
 * @param {{ fail?: boolean, status?: number }} opts
 */
export async function overrideLogin(page, { fail = false, status = 200 } = {}) {
  await page.route("**/api/users/identify", async (route) => {
    if (fail) {
      await route.fulfill({
        status: status || 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "unauthorized", message: "Name or PIN is incorrect." }),
      });
    } else {
      const body = route.request().postDataJSON() ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ userId: 1, userName: body.name ?? "test-user", authorized: true }),
      });
    }
  });
}

/**
 * Override the user settings endpoint for a single test.
 * @param {import('@playwright/test').Page} page
 * @param {object} settings - partial settings object to return
 */
export async function overrideSettings(page, settings = {}) {
  const merged = {
    averageCarMpg: null, yearlyGoalMiles: null, oilChangePrice: null,
    mileageRateCents: null, locationLabel: null, latitude: null, longitude: null,
    dashboardGallonsAvoidedEnabled: false, dashboardGoalProgressEnabled: false,
    updatedAtUtc: null, weatherApiKey: null, eiaGasApiKey: null,
    ...settings,
  };
  await page.route("**/api/users/me/settings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasSettings: true, settings: merged }),
      });
    } else {
      await route.continue();
    }
  });
}
