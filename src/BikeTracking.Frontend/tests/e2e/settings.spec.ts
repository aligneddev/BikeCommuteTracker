import { expect, test } from "@playwright/test";
import {
  createAndLoginUser,
  logoutUser,
  uniqueUser,
} from "./support/auth-helpers";

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

    await logoutUser(page, riderOne);

    await createAndLoginUser(page, riderTwo, TEST_PIN);

    await page.goto("/settings");
    await expect(page.locator("#averageCarMpg")).toHaveValue("");
    await expect(page.locator("#yearlyGoalMiles")).toHaveValue("");
  });

  test("saving gas grade preference is reflected in ride-form gas lookup", async ({
    page,
  }) => {
    const rider = uniqueUser("e2e-settings-gas-grade");
    await createAndLoginUser(page, rider, TEST_PIN);

    await page.goto("/settings");
    await page.locator("#gasGrade").selectOption("Premium");
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText(/settings saved successfully/i)).toBeVisible();

    await page.goto("/rides/record");
    const response = await page.waitForResponse((candidate) =>
      candidate.url().includes("/api/rides/gas-price"),
    );

    const payload = (await response.json()) as {
      grade?: string;
      isAvailable?: boolean;
      pricePerGallon?: number | null;
    };

    expect(payload.grade).toBe("Premium");

    if (payload.isAvailable && payload.pricePerGallon !== null) {
      await expect(page.locator("#gasPrice")).toHaveValue(payload.pricePerGallon.toString());
    }
  });
});
