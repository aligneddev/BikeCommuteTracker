import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_allows_blank_or_missing_optional_fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_allows_blank_or_missing_optional_fields",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and blank optional fields scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "blank_optional_fields" });
  });

  await recorder.step("open page and preview file with blank optional values", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "blank-optional-fields.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,15,2\nSeptember,10,1\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify no validation errors appear in preview", async () => {
    await expect(page.getByText("Valid rows: 2 / Invalid rows: 0")).toBeVisible();
    await expect(page.getByText("Total generated rides: 2")).toBeVisible();
    await expect(page.getByText("Duplicate rides: 0")).toBeVisible();
  });

  await recorder.step("start import and verify all rows import", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 2")).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_allows_blank_or_missing_optional_fields");
  await recorder.save(testInfo);
});
