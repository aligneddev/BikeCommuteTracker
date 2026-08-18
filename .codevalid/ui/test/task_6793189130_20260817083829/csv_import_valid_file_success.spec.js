import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
  mockExpenseHistory,
} from "../../helpers/mock-api.js";

test("csv_import_valid_file_success", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_valid_file_success", "User successfully imports a valid CSV file with no duplicates");

  await recorder.step("Set authenticated bike tracking session and import/history mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "valid_success" });
  await mockExpenseHistory(page, { scenario: "valid_success_after" });

  await recorder.step("Open the expense import page.");
  await page.goto("/expenses/import");
  await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();

  await recorder.step("Choose a valid CSV file.");
  await page.locator("#expense-import-file").setInputFiles({
    name: "expenses.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,12.50,Tube\n05/02/2024,30.00,Chain lube\n05/03/2024,18.25,Brake pads\n"),
  });
  await expect(page.getByText("Selected: expenses.csv")).toBeVisible();

  await recorder.step("Preview the import.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Total rows: 3")).toBeVisible();
  await expect(page.getByText("Valid rows: 3")).toBeVisible();
  await expect(page.getByText("Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Duplicate rows: 0")).toBeVisible();

  await recorder.step("Confirm the import.");
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(page.getByText("Imported rows: 3")).toBeVisible();
  await expect(page.getByText("Skipped rows: 0")).toBeVisible();
  await expect(page.getByText("Failed rows: 0")).toBeVisible();

  await recorder.step("Navigate to expense history and verify imported rows are shown.");
  await page.getByRole("link", { name: "Back to Expense History" }).click();
  await expect(page).toHaveURL(/\/expenses\/history$/);
  await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
  await expect(page.getByText("Tube")).toBeVisible();
  await expect(page.getByText("Chain lube")).toBeVisible();
  await expect(page.getByText("Brake pads")).toBeVisible();
  await expect(page.getByText("Total: $60.75")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_valid_file_success");
  await recorder.save(testInfo);
});
