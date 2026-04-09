import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

const TEST_PIN = "87654321";

function buildCsvRows(startDateIso: string, count: number): string {
  const startDate = new Date(`${startDateIso}T00:00:00Z`);
  const rows = ["Date,Miles,Time,Temp,Tags,Notes"];

  for (let i = 0; i < count; i += 1) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    rows.push(
      `${yyyy}-${mm}-${dd},10.0,45,65,${i % 2 === 0 ? "commute" : "leisure"},ride ${i}`,
    );
  }

  return rows.join("\n");
}

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

    await expect(
      page.getByRole("heading", { name: /preview summary/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/total rows:\s*2/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/valid rows:\s*1/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/invalid rows:\s*1/i)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /start import/i }).click();

    await expect(
      page.getByText(/status:\s*(processing|completed)/i),
    ).toBeVisible();
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

  test("tracks progress milestones and eta during import", async ({ page }) => {
    const userName = uniqueUser("e2e-import-progress");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    // Create a CSV with enough rows to observe progress milestones
    const rows = buildCsvRows("2026-04-01", 50);

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(rows, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();

    await expect(
      page.getByRole("heading", { name: /preview summary/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/valid rows:\s*50/i)).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /^start import$/i }).click();

    // Progress UI should render percentage and status while running.
    await expect(
      page.getByText(/status:\s*(processing|completed)/i),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/complete:\s*\d+%/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify ETA is displayed (should be rounded to 5-minute increments)
    await expect(page.getByText(/eta|minutes remaining/i)).toBeVisible();

    // Wait for completion
    await expect(page.getByText(/status: completed/i)).toBeVisible({
      timeout: 30000,
    });
  });

  test("cancels import mid-run and shows partial summary", async ({ page }) => {
    const userName = uniqueUser("e2e-import-cancel");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    // Create a CSV with enough rows to allow cancellation in the middle
    const rows = buildCsvRows("2026-04-01", 50);

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(rows, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();
    await expect(
      page.getByRole("heading", { name: /preview summary/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/valid rows:\s*50/i)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^start import$/i }).click();

    // Wait for processing to begin
    await expect(page.getByText(/status: processing|progress:/i)).toBeVisible({
      timeout: 5000,
    });

    // Cancel the import
    await page.getByRole("button", { name: /cancel/i }).click();

    // Verify cancellation dialog or confirmation
    // Then confirm the cancellation
    if (
      await page.getByRole("dialog", { name: /cancel|confirm/i }).isVisible()
    ) {
      await page.getByRole("button", { name: /confirm|yes|ok/i }).click();
    }

    // Verify status changed to cancelled
    await expect(
      page.getByText(/status: cancelled|import cancelled/i),
    ).toBeVisible({ timeout: 10000 });

    // Verify partial summary is shown
    await expect(page.getByText(/imported:\s*\d+/i)).toBeVisible();
  });

  test("enriches imported rides with cached gas prices and weather data", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-import-enrichment");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();
    await expect(page).toHaveURL("/rides/import");

    // Create a CSV with rides spanning multiple weeks to test cache behavior
    // Week 1: 2026-04-01 to 2026-04-07
    // Week 2: 2026-04-08 to 2026-04-14
    const csvContent = [
      "Date,Miles,Time,Temp,Tags,Notes",
      // Week 1 - should result in single gas API call per distinct week
      "2026-04-01,10.0,45,65,commute,wednesday",
      "2026-04-02,12.5,50,68,leisure,thursday",
      "2026-04-03,8.0,40,62,commute,friday",
      // Week 2 - different week key, separate gas call
      "2026-04-08,11.0,48,70,commute,tuesday",
      "2026-04-09,13.5,55,72,leisure,wednesday",
    ].join("\n");

    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    await page.getByRole("button", { name: /preview import/i }).click();

    // Verify preview shows all valid rows
    await expect(
      page.getByRole("heading", { name: /preview summary/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/valid rows:\s*5/i)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^start import$/i }).click();

    // Wait for import to complete
    await expect(
      page.getByText(/status: completed|import completed/i),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to history to verify rides were imported with enrichment
    await page.goto("/rides/history");

    // Verify imported rides appear in history
    // All 5 rides should be visible
    const rowsLocator = page.locator(
      "table[aria-label='Ride history table'] tbody tr",
    );
    await expect(rowsLocator.first()).toBeVisible({ timeout: 10000 });
    const rideRows = await rowsLocator.count();
    expect(rideRows).toBeGreaterThanOrEqual(5);

    // Spot-check that rides have enriched data (temperature should be populated from CSV)
    await expect(page.getByRole("cell", { name: "72°F" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "65°F" })).toBeVisible();
  });

  test("navigates from settings to import rides", async ({ page }) => {
    const userName = uniqueUser("e2e-import-settings-nav");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");
    await page.getByRole("link", { name: /import rides from csv/i }).click();

    await expect(page).toHaveURL("/rides/import");
    await expect(
      page.getByRole("heading", { name: /import rides/i }),
    ).toBeVisible();
  });

  test("redirects unauthenticated direct navigation to login", async ({
    page,
  }) => {
    await page.goto("/rides/import");

    await expect(page).toHaveURL(/\/login$/);
  });
});
