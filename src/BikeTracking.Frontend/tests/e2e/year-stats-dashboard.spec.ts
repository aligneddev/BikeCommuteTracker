import { expect, test } from "@playwright/test";
import { uniqueUser } from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

async function signupAndLogin(page: import("@playwright/test").Page, userName: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill("12345678");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill("12345678");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

async function recordRideForYear(
  page: import("@playwright/test").Page,
  miles: string,
  rideDate: string,
) {
  await page.goto("/rides/record");
  await page.getByLabel("Miles (required)").fill(miles);
  const dateField = page.getByLabel(/date & time/i);
  if (await dateField.count()) {
    await dateField.fill(`${rideDate}T12:00`);
  }
  await page.getByRole("button", { name: "Record Ride" }).click();
  await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();
}

test.describe("026-year-stats-dashboard e2e", () => {
  test("navigating via header nav link lands on year stats dashboard with a year selected", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-year-stats-nav");
    await signupAndLogin(page, userName);

    await page.getByRole("link", { name: "Year Stats" }).click();
    await expect(page).toHaveURL("/dashboard/year-stats");
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("default year is the current year, or most recent year with data", async ({ page }) => {
    const userName = uniqueUser("e2e-year-stats-default");
    await signupAndLogin(page, userName);

    await page.goto("/dashboard/year-stats");
    const select = page.getByRole("combobox");
    const currentYear = new Date().getFullYear().toString();
    await expect(select).toHaveValue(currentYear);
  });

  test("switching the year selector updates charts in place without navigation", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-year-stats-switch");
    await signupAndLogin(page, userName);

    await recordRideForYear(page, "12", `${new Date().getFullYear() - 1}-03-15`);

    await page.goto("/dashboard/year-stats");
    const select = page.getByRole("combobox");
    await select.selectOption({ label: (new Date().getFullYear() - 1).toString() });

    await expect(page).toHaveURL("/dashboard/year-stats");
    await expect(page.getByText(`Calendar year ${new Date().getFullYear() - 1}`).first()).toBeVisible();
  });

  test("selecting a year with no ride data shows an explicit no-data state", async ({ page }) => {
    const userName = uniqueUser("e2e-year-stats-empty");
    await signupAndLogin(page, userName);

    // A brand new rider has zero rides in the default (current) year, so the
    // page's own default-year selection already exercises the no-data state.
    await page.goto("/dashboard/year-stats");

    await expect(page.getByText(/no ride data for/i)).toBeVisible();
  });

  test("main dashboard still renders its existing rolling 12-month charts unchanged", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-year-stats-regression");
    await signupAndLogin(page, userName);

    await page.goto("/dashboard");
    await expect(page.getByText("Rolling 12 months").first()).toBeVisible();
  });

  test("total riding time is scoped to the selected year and updates on year change", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-year-stats-riding-time");
    await signupAndLogin(page, userName);

    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    await recordRide(page, {
      rideDateTimeLocal: `${lastYear}-12-31T08:00`,
      miles: "10",
      rideMinutes: "45",
    });
    await recordRide(page, {
      rideDateTimeLocal: `${currentYear}-01-01T08:00`,
      miles: "10",
      rideMinutes: "30",
    });
    await recordRide(page, { miles: "10", rideMinutes: "90" });

    await page.goto("/dashboard/year-stats");
    const ridingTime = page
      .locator(".year-stats-summary-item", { hasText: "Total riding time" })
      .locator("dd");

    await expect(page.getByRole("combobox")).toHaveValue(currentYear.toString());
    await expect(ridingTime).toHaveText("2h 0m");

    await page.getByRole("combobox").selectOption({ label: lastYear.toString() });

    await expect(page).toHaveURL("/dashboard/year-stats");
    await expect(ridingTime).toHaveText("0h 45m");
  });
});
