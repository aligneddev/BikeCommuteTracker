import { expect, test } from "@playwright/test";
import { uniqueUser } from "./support/auth-helpers";
import { moneySavedCard, moneySavedRow } from "./support/expense-helpers";

async function saveDashboardSettings(
  page: import("@playwright/test").Page,
  mpg: string,
  mileageRate: string,
) {
  await page.goto("/settings");
  await page.getByLabel("Average Car MPG").fill(mpg);
  await page.getByLabel("Mileage Rate (cents per mile)").fill(mileageRate);
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText(/settings saved successfully/i)).toBeVisible();
}

async function recordRideWithGasPrice(
  page: import("@playwright/test").Page,
  miles: string,
  gasPrice: string,
) {
  await page.goto("/rides/record");
  await page.getByLabel("Miles (required)").fill(miles);
  await page.getByLabel("Gas Price ($/gal) (optional)").fill(gasPrice);
  await page.getByRole("button", { name: "Record Ride" }).click();
  await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();
}

test.describe("012-dashboard-stats e2e", () => {
  test("authenticated login lands on dashboard", async ({ page }) => {
    const userName = uniqueUser("e2e-dashboard");

    await page.goto("/signup");
    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL("/dashboard");
  });

  test("historical savings stay stable after settings change", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-dashboard-snapshot");

    await page.goto("/signup");
    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/dashboard");

    await saveDashboardSettings(page, "20", "50");
    await recordRideWithGasPrice(page, "10", "3.00");

    await page.goto("/dashboard");
    const card = moneySavedCard(page);
    await expect(moneySavedRow(card, "Mileage rate savings")).toContainText(
      "$500.00",
    );
    await expect(moneySavedRow(card, "Gallons-based savings")).toContainText(
      "$1.50",
    );

    await saveDashboardSettings(page, "40", "70");
    await recordRideWithGasPrice(page, "10", "3.00");

    await page.goto("/dashboard");
    await expect(moneySavedRow(card, "Mileage rate savings")).toContainText(
      "$1,400.00",
    );
    await expect(moneySavedRow(card, "Gallons-based savings")).toContainText(
      "$2.25",
    );
  });

  test("optional metrics appear only after approval", async ({ page }) => {
    const userName = uniqueUser("e2e-dashboard-optional");

    await page.goto("/signup");
    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("12345678");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/dashboard");

    await expect(page.getByText("More metrics are available")).toBeVisible();
    await expect(page.getByText("Gallons Avoided:")).toBeVisible();
    await expect(page.getByText("Goal Progress:")).toBeVisible();
    await expect(page.getByText("Approved Metric")).not.toBeVisible();

    await page.goto("/settings");
    await page.getByLabel("Show gallons avoided metric").check();
    await page.getByLabel("Show goal progress metric").check();
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText(/settings saved successfully/i)).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("Approved Metric")).toHaveCount(2);
    await expect(page.getByText("Gallons Avoided")).toBeVisible();
    await expect(page.getByText("Goal Progress")).toBeVisible();
    await expect(
      page.getByText("More metrics are available"),
    ).not.toBeVisible();
  });
});
