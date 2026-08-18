import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_empty_file", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_empty_file",
    testTitle: "Empty CSV file is rejected with clear error",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(400, {
      message: "No valid rows found in CSV file. Please check formatting and try again.",
    }));
  });

  await recorder.step("Navigate to Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload an empty CSV file.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "empty.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("", "utf8"),
  });
  await expect(page.getByText("Selected file: empty.csv")).toBeVisible();

  await recorder.step("Preview and verify the user-facing empty file error message.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("No valid rows found in CSV file. Please check formatting and try again.")).toBeVisible();
  await expect(page.getByText("Start an import to see progress and cancellation controls.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_empty_file");
  await recorder.save(testInfo);
});
