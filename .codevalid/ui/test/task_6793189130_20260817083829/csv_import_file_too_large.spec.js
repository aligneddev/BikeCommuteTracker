import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupBikeTrackingAuthenticatedSession } from "../../helpers/mock-api.js";

test("csv_import_file_too_large", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_file_too_large", "User attempts to upload CSV file larger than 5 MB");

  await recorder.step("Set authenticated bike tracking session.");
  await setupBikeTrackingAuthenticatedSession(page);

  await recorder.step("Open expense import page.");
  await page.goto("/expenses/import");
  await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();

  await recorder.step("Select a CSV file larger than 5 MB.");
  await page.locator("#expense-import-file").setInputFiles({
    name: "oversize.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(6 * 1024 * 1024, "a"),
  });

  await recorder.step("Verify upload is blocked with clear feedback.");
  await expect(page.getByRole("alert")).toHaveText("CSV file must be 5 MB or smaller.");
  await expect(page.getByRole("heading", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByText(/Selected:/)).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_file_too_large");
  await recorder.save(testInfo);
});
