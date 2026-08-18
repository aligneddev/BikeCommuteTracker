import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_note_exceeds_max_length", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_note_exceeds_max_length", "CSV contains a row with note longer than 500 characters");

  await recorder.step("Set authenticated session and note length validation mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "note_too_long" });

  await recorder.step("Upload CSV with an oversized note.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "note-too-long.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,12.00,oversized\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify preview marks the row invalid.");
  await expect(page.getByText("Total rows: 1")).toBeVisible();
  await expect(page.getByText("Valid rows: 0")).toBeVisible();
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 2: Note cannot exceed 500 characters.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_note_exceeds_max_length");
  await recorder.save(testInfo);
});
