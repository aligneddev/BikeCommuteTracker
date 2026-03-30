import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";

const TEST_PIN = "87654321";

test.describe("009-settings e2e", () => {
  test("keeps settings isolated between authenticated riders", async ({
    page,
  }) => {
    const riderOne = uniqueUser("e2e-settings-rider-1");
    const riderTwo = uniqueUser("e2e-settings-rider-2");

    await createAndLoginUser(page, riderOne, TEST_PIN);

    await page.goto("/settings");
    await page.locator("#averageCarMpg").fill("29.5");
    await page.locator("#yearlyGoalMiles").fill("1234");
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText(/settings saved successfully/i)).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");

    await createAndLoginUser(page, riderTwo, TEST_PIN);

    await page.goto("/settings");
    await expect(page.locator("#averageCarMpg")).toHaveValue("");
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("");
  });
});
