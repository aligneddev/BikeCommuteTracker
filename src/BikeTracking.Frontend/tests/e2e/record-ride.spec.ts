import { expect, test } from "@playwright/test";
import {
  createAndLoginUser,
  saveUserLocation,
  uniqueUser,
} from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

const TEST_PIN = "87654321";

async function openSettingsFromUserMenu(
  page: import("@playwright/test").Page,
  userName: string,
) {
  await page.getByRole("button", { name: userName }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL("/settings");
}

test.describe("004-record-ride e2e", () => {
  test("records a ride from the record page", async ({ page }) => {
    const userName = uniqueUser("e2e-record-ride");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordRide(page, {
      miles: "12.34",
      rideMinutes: "41",
      temperature: "68",
    });
  });

  test("manages presets in settings and applies MRU preset during ride entry", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-ride-presets");
    await createAndLoginUser(page, userName, TEST_PIN);

    await openSettingsFromUserMenu(page, userName);

    await page.getByLabel("Preset Name").fill("Morning Commute");
    await page.getByLabel("Duration Minutes").fill("34");
    await page.getByRole("button", { name: "Add Preset" }).click();

    await expect(page.getByText(/preset created\./i)).toBeVisible();
    await expect(page.locator(".settings-presets-list")).toContainText(
      "Morning Commute",
    );

    await page.getByLabel("Preset Name").fill("Afternoon Return");
    await page.getByLabel("Period Tag").selectOption("afternoon");
    await expect(page.getByLabel("Primary Direction")).toHaveValue("NE");
    await page.getByLabel("Exact Start Time").fill("17:35");
    await page.getByLabel("Duration Minutes").fill("32");
    await page.getByRole("button", { name: "Add Preset" }).click();

    await expect(page.getByText(/preset created\./i)).toBeVisible();
    await expect(page.locator(".settings-presets-list")).toContainText(
      "Afternoon Return",
    );

    const morningItem = page.locator(".settings-presets-item").filter({
      hasText: "Morning Commute",
    });
    await morningItem.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Preset Name").fill("Morning Express");
    await page.getByRole("button", { name: "Save Preset" }).click();

    await expect(page.getByText(/preset updated\./i)).toBeVisible();
    await expect(page.locator(".settings-presets-list")).toContainText(
      "Morning Express",
    );

    await page.goto("/rides/record");
    await expect(page).toHaveURL("/rides/record");
    await expect(page.getByText(/quick ride options/i)).toHaveCount(0);

    await page
      .getByLabel("Ride Preset")
      .selectOption("Morning Express (morning, 07:45, 34 min)");
    await page.getByRole("button", { name: "Apply Preset" }).click();

    await expect(page.getByLabel(/primary direction of travel/i)).toHaveValue(
      "SW",
    );
    await expect(page.locator("#rideMinutes")).toHaveValue("34");
    await expect(page.locator("#rideDateTimeLocal")).toHaveValue(/T07:45$/);

    await page.locator("#miles").fill("8.40");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();

    await page.goto("/rides/record");
    const firstPresetOption = page.locator("#ridePreset option").nth(1);
    await expect(firstPresetOption).toContainText("Morning Express");
    await expect(page.getByText(/quick ride options/i)).toHaveCount(0);

    await page.goto("/settings");
    const afternoonItem = page.locator(".settings-presets-item").filter({
      hasText: "Afternoon Return",
    });
    await afternoonItem.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(/preset deleted\./i)).toBeVisible();
    await expect(page.locator(".settings-presets-list")).not.toContainText(
      "Afternoon Return",
    );
  });

  test("shows gas price, prepopulates it, and displays it in history", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-gas-price");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordRide(page, {
      miles: "10.00",
      rideMinutes: "30",
      temperature: "64",
      gasPrice: "3.4567",
    });

    await page.goto("/rides/record");
    await expect(page.locator("#gasPrice")).toBeVisible();
    await expect(page.locator("#gasPrice")).toHaveValue("3.4567");

    await page.locator("#miles").fill("11.00");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();

    await page.getByRole("link", { name: "Ride History" }).click();
    await expect(page).toHaveURL(/\/rides\/history$/);
    await expect(page.getByText("$3.4567").first()).toBeVisible();
  });

  test("loads weather into create form before save", async ({ page }) => {
    const userName = uniqueUser("e2e-load-weather-create");
    await createAndLoginUser(page, userName, TEST_PIN);
    await saveUserLocation(page, "40.71", "-74.01");

    await page.route("**/api/rides/weather**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rideDateTimeLocal: "2026-04-03T08:00:00",
          temperature: 58.2,
          windSpeedMph: 12.4,
          windDirectionDeg: 240,
          relativeHumidityPercent: 81,
          cloudCoverPercent: 72,
          precipitationType: "rain",
          isAvailable: true,
        }),
      });
    });

    await page.goto("/rides/record");
    await expect(page).toHaveURL("/rides/record");

    await page.locator("#temperature").fill("");
    await page.locator("#windSpeedMph").fill("");

    await page.getByRole("button", { name: "Load Weather" }).click();

    await expect(page.locator("#temperature")).toHaveValue("58.2");
    await expect(page.locator("#windSpeedMph")).toHaveValue("12.4");
  });
});
