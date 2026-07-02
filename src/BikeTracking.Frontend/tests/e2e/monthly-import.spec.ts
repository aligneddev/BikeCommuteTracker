import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";

const TEST_PIN = "87654321";

async function gotoMonthlyImport(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/import/monthly");
  await expect(
    page.getByRole("heading", { name: /monthly summary import/i }),
  ).toBeVisible();
}

async function pasteAndPreview(
  page: import("@playwright/test").Page,
  text: string,
  year: string,
): Promise<void> {
  await page.locator("#monthly-import-textarea").fill(text);
  await page.getByLabel(/start year/i).fill(year);
  await page.getByRole("button", { name: /preview import/i }).click();
}

test.describe("025-monthly-summary-import e2e", () => {
  test("pastes 3 months and previews correct ride count per month", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-monthly-3mo");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text =
      "Month\tMiles\tDays\nJanuary\t96\t8\nFebruary\t60\t5\nMarch\t120\t10\n";
    await pasteAndPreview(page, text, "2025");

    await expect(page.getByText(/total generated rides:\s*23/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("cell", { name: "January" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "February" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "March" })).toBeVisible();
  });

  test("selecting a year updates generated ride dates", async ({ page }) => {
    const userName = uniqueUser("e2e-monthly-year");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text = "Month\tMiles\tDays\nMay\t96\t1\n";
    await pasteAndPreview(page, text, "2030");

    await expect(page.getByText(/2030-05/)).toBeVisible({ timeout: 10000 });
  });

  test("year boundary Nov to Feb starting 2025 assigns years correctly", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-monthly-boundary");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text =
      "Month\tMiles\tDays\nNovember\t80\t1\nDecember\t100\t1\nJanuary\t60\t1\nFebruary\t50\t1\n";
    await pasteAndPreview(page, text, "2025");

    await expect(page.getByText(/2025-11/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2025-12/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2026-01/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2026-02/)).toBeVisible({ timeout: 10000 });
  });

  test("confirming an import creates rides tagged monthly-import in ride history", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-monthly-confirm");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text = "Month\tMiles\tDays\nMay\t96\t1\n";
    await pasteAndPreview(page, text, "2031");

    await expect(
      page.getByRole("button", { name: /^start import$/i }),
    ).toBeEnabled({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /^start import$/i }).click();

    await expect(
      page.getByText(/status:\s*(processing|completed)/i),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: /monthly import summary/i }),
    ).toBeVisible({
      timeout: 20000,
    });

    await page.goto("/rides/history");
    await expect(page.getByTestId("ride-import-tag").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("ride-import-tag").first()).toHaveText(
      /monthly-import/i,
    );
  });

  test("re-importing the same month surfaces duplicate resolution and keep/replace works", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-monthly-dup");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text = "Month\tMiles\tDays\nMay\t96\t1\n";

    // First import.
    await pasteAndPreview(page, text, "2032");
    await expect(
      page.getByRole("button", { name: /^start import$/i }),
    ).toBeEnabled({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /^start import$/i }).click();
    await expect(
      page.getByRole("heading", { name: /monthly import summary/i }),
    ).toBeVisible({
      timeout: 20000,
    });

    // Re-import the same data — should be flagged as a duplicate.
    await page.reload();
    await gotoMonthlyImport(page);
    await pasteAndPreview(page, text, "2032");
    await expect(page.getByText(/duplicate rides:\s*1/i)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^start import$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /duplicate resolution/i }),
    ).toBeVisible();

    const dialog = page.getByRole("dialog", { name: /duplicate resolution/i });
    await dialog.getByLabel(/row 1 keep existing/i).check();
    await dialog.getByRole("button", { name: /start import/i }).click();

    await expect(
      page.getByText(/status:\s*(processing|completed)/i),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("invalid month name is surfaced before confirmation and blocks import", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-monthly-invalid");
    await createAndLoginUser(page, userName, TEST_PIN);
    await gotoMonthlyImport(page);

    const text = "Month\tMiles\tDays\nJnauary\t96\t8\n";
    await pasteAndPreview(page, text, "2025");

    await expect(page.getByText(/unrecognised month name/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /^start import$/i }),
    ).toBeDisabled();
  });
});
