import { expect, test, type Page } from "@playwright/test";

const TEST_PIN = "87654321";

function uniqueUser(prefix: string): string {
  const suffix = crypto.getRandomValues(new Uint32Array(1))[0];
  return `${prefix}-${Date.now()}-${suffix}`;
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function createAndLoginUser(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/login");
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/miles");
}

test.describe("004-record-ride e2e", () => {
  test("records a ride from the record page", async ({ page }) => {
    const userName = uniqueUser("e2e-record-ride");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL("/rides/record");

    await page
      .getByLabel(/date & time/i)
      .fill(toDateTimeLocalValue(new Date()));
    await page.getByLabel(/miles/i).fill("12.34");
    await page.getByLabel(/duration/i).fill("41");
    await page.getByLabel(/temperature/i).fill("68");
    await page.getByRole("button", { name: "Record Ride" }).click();

    await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();
  });

  test("prefills defaults from the previous ride", async ({ page }) => {
    const userName = uniqueUser("e2e-ride-defaults");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/rides/record");
    await expect(page).toHaveURL("/rides/record");

    await page
      .getByLabel(/date & time/i)
      .fill(toDateTimeLocalValue(new Date()));
    await page.getByLabel(/miles/i).fill("9.75");
    await page.getByLabel(/duration/i).fill("35");
    await page.getByLabel(/temperature/i).fill("61");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();

    await page.goto("/miles");
    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL("/rides/record");

    await expect(page.getByLabel(/miles/i)).toHaveValue("9.75");
    await expect(page.getByLabel(/duration/i)).toHaveValue("35");
    await expect(page.getByLabel(/temperature/i)).toHaveValue("61");
  });
});
