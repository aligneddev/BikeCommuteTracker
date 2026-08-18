import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupBikeTrackingAuthenticatedSession } from "../../helpers/mock-api.js";

test("csv_import_no_files_selected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_no_files_selected", "User clicks import without selecting a file");

  await recorder.step("Set authenticated session.");
  await setupBikeTrackingAuthenticatedSession(page);

  await recorder.step("Open import page without choosing a file.");
  await page.goto("/expenses/import");
  await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();

  await recorder.step("Click Preview Import without selecting a file.");
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify guidance and that no processing starts.");
  await expect(page.getByRole("alert")).toHaveText("Select a CSV file before previewing import results.");
  await expect(page.getByRole("heading", { name: "Preview" })).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_no_files_selected");
  await recorder.save(testInfo);
});
