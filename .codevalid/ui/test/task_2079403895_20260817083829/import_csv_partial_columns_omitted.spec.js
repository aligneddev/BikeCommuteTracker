import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_partial_columns_omitted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_partial_columns_omitted",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and missing optional columns scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "missing_optional_columns" });
  });

  await recorder.step("open page and preview legacy csv without optional columns", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "legacy-columns.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nJuly,20,2\nAugust,18,2\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify preview accepts rows without optional columns", async () => {
    await expect(page.getByText("Valid rows: 2 / Invalid rows: 0")).toBeVisible();
    await expect(page.getByText("Total generated rides: 2")).toBeVisible();
  });

  await recorder.step("start import and confirm compatibility behavior", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 2")).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_partial_columns_omitted");
  await recorder.save(testInfo);
});
