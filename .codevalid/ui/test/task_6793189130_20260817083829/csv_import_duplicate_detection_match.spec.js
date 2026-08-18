import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_duplicate_detection_match", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_duplicate_detection_match", "CSV contains duplicate expense entries matching existing records");

  await recorder.step("Set authenticated session and duplicate detection preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "duplicate_match" });

  await recorder.step("Upload CSV containing duplicate row.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "duplicate.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n2024-05-10,45.00,Incoming duplicate\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify duplicate preview and resolution options are shown.");
  await expect(page.getByText("Duplicate rows: 1")).toBeVisible();
  await expect(page.getByText("Row 2: 2024-05-10 · $45.00")).toBeVisible();
  await expect(page.getByLabel("Keep Existing")).toBeVisible();
  await expect(page.getByLabel("Replace with Import")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_duplicate_detection_match");
  await recorder.save(testInfo);
});
