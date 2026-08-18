import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("duplicate_rows_trigger_resolution_dialog", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "duplicate_rows_trigger_resolution_dialog",
    testTitle: "Duplicate rows open the duplicate resolution dialog",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 110,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 1,
      requiresDuplicateResolution: true,
      rows: [
        {
          rowNumber: 1,
          date: "2024-05-01T08:00:00",
          miles: 10,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: null,
          isValid: true,
          errors: [],
          duplicateMatches: [
            {
              existingRideId: 5001,
              existingRideDate: "2024-05-01T08:00:00",
              existingMiles: 10,
            },
          ],
        },
      ],
    }));
  });

  let cancelCalled = false;
  await page.route("**/api/imports/110/cancel", async (route) => {
    cancelCalled = true;
    await route.fulfill(jsonResponse(200, {
      importJobId: 110,
      status: "cancelled",
      processedRows: 0,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      cancelledAtUtc: "2026-08-18T12:00:10Z",
    }));
  });

  await recorder.step("Go to Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV whose row duplicates an existing ride.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-duplicate.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles",
      "2024-05-01T08:00:00,10",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview the import and trigger duplicate resolution by starting the import.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Duplicate rows: 1 | Resolve duplicates before starting import.")).toBeVisible();
  await page.getByRole("button", { name: "Start Import" }).click();

  await recorder.step("Verify the duplicate resolution dialog contents and available actions.");
  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toBeVisible();
  await expect(page.getByText("Row 1")).toBeVisible();
  await expect(page.getByText("Existing ride #5001: 2024-05-01T08:00:00 • 10.0 mi")).toBeVisible();
  await expect(page.getByText("Override all duplicates")).toBeVisible();
  await expect(page.getByText("Row 1 keep existing")).toBeVisible();
  await expect(page.getByText("Row 1 replace with import")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Import" })).toBeVisible();

  await recorder.step("Cancel the duplicate-resolution flow and verify the preview is discarded.");
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(cancelCalled).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toHaveCount(0);
  await expect(page.getByText("No file selected.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_rows_trigger_resolution_dialog");
  await recorder.save(testInfo);
});
