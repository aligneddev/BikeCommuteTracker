import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

test("import_cancelled_by_user", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_cancelled_by_user",
    testTitle: "Changing selection back to empty preserves initial UI state and avoids import API calls",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  let previewCalled = false;
  await page.route("**/api/imports/preview", async (route) => {
    previewCalled = true;
    await route.abort();
  });

  await recorder.step("Open Import Rides.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Select a valid CSV file.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-to-cancel.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles",
      "2024-05-01T08:00:00,10",
    ].join("\n"), "utf8"),
  });
  await expect(page.getByText("Selected file: rides-to-cancel.csv")).toBeVisible();

  await recorder.step("Clear the file input to simulate the user cancelling out before submission.");
  await page.locator("#csv-upload-input").setInputFiles([]);
  await expect(page.getByText("No file selected.")).toBeVisible();
  await expect(page.getByText("Start an import to see progress and cancellation controls.")).toBeVisible();

  await recorder.step("Verify no preview or import API calls were made.");
  expect(previewCalled).toBeFalsy();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_cancelled_by_user");
  await recorder.save(testInfo);
});
