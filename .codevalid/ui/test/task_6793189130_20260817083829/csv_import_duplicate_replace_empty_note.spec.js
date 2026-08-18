import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
  mockExpenseHistory,
} from "../../helpers/mock-api.js";

test("csv_import_duplicate_replace_empty_note", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_duplicate_replace_empty_note", "User chooses 'Replace with Import' on duplicate with blank CSV note");

  await recorder.step("Set authenticated session and duplicate replace-preserve-note mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "duplicate_replace_empty_note" });
  await mockExpenseHistory(page, { scenario: "duplicate_replace_empty_note_after" });

  await recorder.step("Upload duplicate CSV and preview it.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "replace-empty-note.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n2024-05-10,45.00,\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Choose Replace with Import and confirm.");
  await page.getByLabel("Replace with Import").check();
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();

  await recorder.step("Verify existing note is preserved in history.");
  await page.getByRole("link", { name: "Back to Expense History" }).click();
  await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
  await expect(page.getByText("Original note")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_duplicate_replace_empty_note");
  await recorder.save(testInfo);
});
