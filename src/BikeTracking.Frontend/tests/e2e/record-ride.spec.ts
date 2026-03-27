import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

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
});
