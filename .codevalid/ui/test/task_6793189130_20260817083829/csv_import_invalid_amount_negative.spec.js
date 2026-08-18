import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_invalid_amount_negative", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_invalid_amount_negative", "CSV contains a row with negative amount");

  await recorder.step("Set authenticated session and negative amount preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "negative_amount" });

  await recorder.step("Open expense import page and upload CSV.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "negative.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,-50.00,Bad row\n"),
  });

  await recorder.step("Preview row validation.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Total rows: 1")).toBeVisible();
  await expect(page.getByText("Valid rows: 0")).toBeVisible();
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 2: Amount must be positive.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_invalid_amount_negative");
  await recorder.save(testInfo);
});
