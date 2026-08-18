import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupBikeTrackingAuthenticatedSession } from "../../helpers/mock-api.js";

test("csv_import_invalid_file_extension", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_invalid_file_extension", "User attempts to upload non-CSV file (.xlsx, .txt)");

  await recorder.step("Set authenticated bike tracking session.");
  await setupBikeTrackingAuthenticatedSession(page);

  await recorder.step("Open expense import page.");
  await page.goto("/expenses/import");
  await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();

  await recorder.step("Select a non-CSV file.");
  await page.locator("#expense-import-file").setInputFiles({
    name: "data.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("not-a-csv"),
  });

  await recorder.step("Verify the file is rejected.");
  await expect(page.getByRole("alert")).toHaveText("Please upload a .csv file.");
  await expect(page.getByRole("heading", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByText(/Selected:/)).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_invalid_file_extension");
  await recorder.save(testInfo);
});
