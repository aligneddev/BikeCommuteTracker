import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordRide, selectQuickRideOption } from "./support/ride-helpers";

const TEST_PIN = "87654321";

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

  test("prefills defaults from the previous ride", async ({ page }) => {
    const userName = uniqueUser("e2e-ride-defaults");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordRide(page, {
      miles: "9.75",
      rideMinutes: "35",
      temperature: "61",
    });

    await page.goto("/miles");
    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL("/rides/record");

    await expect(page.locator("#miles")).toHaveValue("9.75");
    await expect(page.locator("#rideMinutes")).toHaveValue("35");
    await expect(page.locator("#temperature")).toHaveValue("61");
  });

  test("allows editing quick-option copied values before save", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-quick-option-edit");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordRide(page, {
      miles: "8.50",
      rideMinutes: "30",
      temperature: "60",
    });

    await page.goto("/rides/record");

    await selectQuickRideOption(page, /8\.5 mi\s*-\s*30 min/i);

    await page.locator("#miles").fill("9.25");
    await page.locator("#rideMinutes").fill("33");

    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();
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
});
