import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_summary_after_import_completed", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_summary_after_import_completed", "Post-import summary shows accurate counts and metrics");

  await recorder.step("Set authenticated session and summary counts scenario mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "summary_counts" });

  await recorder.step("Open import page and preview the CSV.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "summary.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,10.00,One\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Confirm import and verify summary metrics.");
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(page.getByText("Imported rows: 7")).toBeVisible();
  await expect(page.getByText("Skipped rows: 1")).toBeVisible();
  await expect(page.getByText("Failed rows: 2")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_summary_after_import_completed");
  await recorder.save(testInfo);
});
