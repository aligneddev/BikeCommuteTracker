import { expect, test } from "@playwright/test";
import {
  createAndLoginUser,
  saveUserLocation,
  uniqueUser,
} from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

// E2E scenarios for spec-006-edit-ride-history
// Prerequisites: User signed up and recorded at least one ride
// Tests: inline edit mode, validation, conflict handling, and totals refresh

test.describe("006-edit-ride-history e2e", () => {
  test.beforeEach(async ({ page }) => {
    const userName = uniqueUser("e2e-edit-history");
    await createAndLoginUser(page, userName, "87654321");

    // Record a ride on a date that is always within the current month so the
    // "This Month" mileage summary card reflects the seeded ride.
    const now = new Date();
    const rideDateTimeLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T10:30`;

    await recordRide(page, {
      rideDateTimeLocal,
      miles: "5.0",
      rideMinutes: "30",
      temperature: "70",
    });

    // Navigate to history
    await page.goto("/rides/history");
    await expect(
      page.getByRole("table", { name: /ride history table/i }),
    ).toBeVisible();
  });

  test("enters edit mode, modifies miles, saves successfully, and refreshes totals", async ({
    page,
  }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    const milesInput = firstRow.locator('input[id^="edit-ride-miles-"]');
    await expect(milesInput).toBeVisible();
    await milesInput.fill("8.5");

    await firstRow.getByRole("button", { name: "Save" }).click();

    // Verify the row updates to show new miles value in the grid
    await expect(
      page
        .getByRole("table", { name: /ride history table/i })
        .getByText("8.5 mi"),
    ).toBeVisible();

    // Verify summary cards refresh (all should show 8.5)
    const summaryMiles = page.locator('[class*="mileage-summary-miles"]');
    const count = await summaryMiles.count();
    for (let i = 0; i < count; i++) {
      const text = await summaryMiles.nth(i).textContent();
      expect(text).toContain("8.5 mi");
    }
  });

  test("blocks save and shows validation message for invalid miles", async ({
    page,
  }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    const milesInput = firstRow.locator('input[id^="edit-ride-miles-"]');
    await expect(milesInput).toBeVisible();
    await milesInput.fill("0");

    await firstRow.getByRole("button", { name: "Save" }).click();

    // Expect validation error message
    await expect(page.getByRole("alert")).toContainText(
      /miles must be greater than 0/i,
    );

    // Edit mode should remain active
    await expect(
      firstRow.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
  });

  test("cancels edit and discards in-progress changes", async ({ page }) => {
    // Capture original value
    const originalText = await page
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .textContent();
    expect(originalText).toContain("5.0 mi");

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    const milesInput = firstRow.locator('input[id^="edit-ride-miles-"]');
    await expect(milesInput).toBeVisible();
    await milesInput.fill("99.0");

    await firstRow.getByRole("button", { name: "Cancel" }).click();

    // Edit mode should exit and original value should be restored
    await expect(
      page.getByRole("button", { name: "Edit" }).first(),
    ).toBeVisible();
    const restoreText = await page
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .textContent();
    expect(restoreText).toContain("5.0 mi");
  });

  test("shows summary cards with historical totals and active filter", async ({
    page,
  }) => {
    // Apply a date filter spanning the current month so the seeded ride is visible.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const fromDate = `${year}-${month}-01`;
    const toDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    const fromInput = page.getByLabel(/^From$/i);
    const toInput = page.getByLabel(/^To$/i);

    await fromInput.fill(fromDate);
    await toInput.fill(toDate);
    await page.getByRole("button", { name: /apply filter/i }).click();

    // Summary cards and visible total should be visible
    await expect(page.getByText(/this month/i)).toBeVisible();
    await expect(
      page.getByLabel("Visible total miles").getByText("5.0 mi"),
    ).toBeVisible();

    // Edit the ride to 10 miles
    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    const milesInput = firstRow.locator('input[id^="edit-ride-miles-"]');
    await expect(milesInput).toBeVisible();
    await milesInput.fill("10.0");

    await firstRow.getByRole("button", { name: "Save" }).click();

    // Totals should update to reflect new 10 mi value
    const summaryCards = page.getByText(/this month/i);
    await expect(summaryCards).toBeVisible();
    // The visible total should update
    await expect(
      page.getByLabel("Visible total miles").getByText("10.0 mi"),
    ).toBeVisible();
  });

  test("loads weather into edit form before save", async ({ page }) => {
    const userName = uniqueUser("e2e-edit-load-weather");
    await createAndLoginUser(page, userName, "87654321");
    await saveUserLocation(page, "40.71", "-74.01");

    await page.route("**/api/rides/weather**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rideDateTimeLocal: "2026-03-20T10:30:00",
          temperature: 51.5,
          windSpeedMph: 8.4,
          windDirectionDeg: 195,
          relativeHumidityPercent: 77,
          cloudCoverPercent: 66,
          precipitationType: "snow",
          isAvailable: true,
        }),
      });
    });

    const now = new Date();
    const rideDateTimeLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-02T10:30`;

    await recordRide(page, {
      rideDateTimeLocal,
      miles: "5.0",
      rideMinutes: "30",
    });

    await page.goto("/rides/history");
    await expect(
      page.getByRole("table", { name: /ride history table/i }),
    ).toBeVisible();

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    const temperatureInput = firstRow.locator(
      'input[id^="edit-ride-temperature-"]',
    );
    const windSpeedInput = firstRow.locator(
      'input[id^="edit-ride-wind-speed-"]',
    );
    await expect(temperatureInput).toBeVisible();
    await temperatureInput.fill("");
    await windSpeedInput.fill("");

    await firstRow.getByRole("button", { name: "Load Weather" }).click();

    await expect(temperatureInput).toHaveValue("51.5");
    await expect(windSpeedInput).toHaveValue("8.4");
  });
});
