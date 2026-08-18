import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
  mockExpenseHistory,
} from "../../helpers/mock-api.js";

test("csv_import_override_all_duplicates", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_override_all_duplicates", "User selects 'Override All Duplicates' to import duplicates as new records");

  await recorder.step("Set authenticated session and override-all duplicate mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "override_all_duplicates" });
  await mockExpenseHistory(page, { scenario: "override_all_duplicates_after" });

  await recorder.step("Upload duplicate CSV and preview it.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "override-all.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n2024-05-10,45.00,Imported duplicate\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Enable Override All Duplicates and confirm import.");
  await page.getByLabel("Override All Duplicates").check();
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(page.getByText("Imported rows: 1")).toBeVisible();
  await expect(page.getByText("Skipped rows: 0")).toBeVisible();

  await recorder.step("Verify both existing and imported expenses are present in history.");
  await page.getByRole("link", { name: "Back to Expense History" }).click();
  await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
  await expect(page.getByText("Existing expense")).toBeVisible();
  await expect(page.getByText("Imported duplicate")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_override_all_duplicates");
  await recorder.save(testInfo);
});
