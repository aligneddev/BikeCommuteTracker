import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
  mockExpenseHistory,
} from "../../helpers/mock-api.js";

test("csv_import_duplicate_replace_with_note", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_duplicate_replace_with_note", "User chooses 'Replace with Import' on duplicate with non-blank note");

  await recorder.step("Set authenticated session plus duplicate replace preview/confirm/history mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "duplicate_replace_with_note" });
  await mockExpenseHistory(page, { scenario: "duplicate_replace_with_note_after" });

  await recorder.step("Upload duplicate CSV and preview it.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "replace-note.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n2024-05-10,45.00,New note\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Choose Replace with Import and confirm.");
  await page.getByLabel("Replace with Import").check();
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(page.getByText("Imported rows: 0")).toBeVisible();
  await expect(page.getByText("Skipped rows: 0")).toBeVisible();

  await recorder.step("Open history and verify note was replaced.");
  await page.getByRole("link", { name: "Back to Expense History" }).click();
  await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
  await expect(page.getByText("New note")).toBeVisible();
  await expect(page.getByText("Old note")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_duplicate_replace_with_note");
  await recorder.save(testInfo);
});
