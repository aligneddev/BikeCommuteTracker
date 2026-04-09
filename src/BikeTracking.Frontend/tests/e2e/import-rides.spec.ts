import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

const TEST_PIN = "87654321";

test.describe("013-csv-import e2e", () => {
  test("upload preview and start import happy path", async ({ page }) => {
    const userName = uniqueUser("e2e-import-rides");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    const csvContent = [
      "Date,Miles,Time,Temp,Tags,Notes",
      "2026-04-01,12.5,45,60,commute,morning ride",
      "2026-04-02,0,40,58,commute,invalid miles",
    ].join("\n");

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();

    await expect(page.getByText(/total rows: 2/i)).toBeVisible();
    await expect(page.getByText(/valid rows: 1/i)).toBeVisible();
    await expect(page.getByText(/invalid rows: 1/i)).toBeVisible();

    await page.getByRole("button", { name: /start import/i }).click();

    await expect(page.getByText(/status: processing/i)).toBeVisible();
  });

  test("resolves a duplicate with keep existing", async ({ page }) => {
    const userName = uniqueUser("e2e-import-duplicate-keep");
    await createAndLoginUser(page, userName, TEST_PIN);
    await recordRide(page, {
      rideDateTimeLocal: "2026-04-01T08:00",
      miles: "12.5",
      rideMinutes: "45",
      temperature: "60",
    });

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    const csvContent = [
      "Date,Miles,Time,Temp,Tags,Notes",
      "2026-04-01,12.5,45,60,commute,duplicate ride",
    ].join("\n");

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();

    await expect(page.getByText(/duplicate rows: 1/i)).toBeVisible();
    await page.getByRole("button", { name: /^start import$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /duplicate resolution/i }),
    ).toBeVisible();

    await page.getByLabel(/row 1 keep existing/i).check();
    await page.getByRole("button", { name: /^start import$/i }).click();

    await expect(page.getByText(/status: processing/i)).toBeVisible();
  });

  test("resolves a duplicate with replace-with-import", async ({ page }) => {
    const userName = uniqueUser("e2e-import-duplicate-replace");
    await createAndLoginUser(page, userName, TEST_PIN);
    await recordRide(page, {
      rideDateTimeLocal: "2026-04-01T08:00",
      miles: "12.5",
      rideMinutes: "45",
      temperature: "60",
    });

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    const csvContent = [
      "Date,Miles,Time,Temp,Tags,Notes",
      "2026-04-01,12.5,45,60,commute,duplicate ride",
    ].join("\n");

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();

    await expect(page.getByText(/duplicate rows: 1/i)).toBeVisible();
    await page.getByRole("button", { name: /^start import$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /duplicate resolution/i }),
    ).toBeVisible();

    await page.getByLabel(/row 1 replace with import/i).check();
    await page.getByRole("button", { name: /^start import$/i }).click();

    await expect(page.getByText(/status: processing/i)).toBeVisible();
  });
});
