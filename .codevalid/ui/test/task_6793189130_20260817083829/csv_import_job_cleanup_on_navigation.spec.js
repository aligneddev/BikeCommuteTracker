import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
  mockExpenseHistory,
} from "../../helpers/mock-api.js";

test("csv_import_job_cleanup_on_navigation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_job_cleanup_on_navigation", "Import job and transient data are deleted when navigating away from summary");

  await recorder.step("Set authenticated session and import cleanup mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "job_cleanup_navigation" });
  await mockExpenseHistory(page, { scenario: "job_cleanup_navigation_after" });

  await recorder.step("Preview and confirm import to reach summary.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "cleanup.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,12.00,Imported row\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();

  await recorder.step("Navigate away and ensure only history remains visible.");
  await page.getByRole("link", { name: "Back to Expense History" }).click();
  await expect(page).toHaveURL(/\/expenses\/history$/);
  await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import complete" })).toHaveCount(0);
  await expect(page.getByText("Imported row")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_job_cleanup_on_navigation");
  await recorder.save(testInfo);
});
