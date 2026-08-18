import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_notes_exactly_500_characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_notes_exactly_500_characters",
    testTitle: "CSV notes exactly 500 characters import successfully",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const exact500 = "B".repeat(500);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 108,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2024-05-01T08:00:00",
          miles: 10,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: exact500,
          isValid: true,
          errors: [],
          duplicateMatches: [],
        },
      ],
    }));
  });

  await page.route("**/api/imports/start", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 108,
      status: "processing",
      startedAtUtc: "2026-08-18T12:00:01Z",
    }));
  });

  await page.route("**/api/imports/108/status", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 108,
      status: "completed",
      totalRows: 1,
      processedRows: 1,
      importedRows: 1,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 100,
      etaMinutesRounded: 0,
      createdAtUtc: "2026-08-18T12:00:00Z",
      startedAtUtc: "2026-08-18T12:00:01Z",
      completedAtUtc: "2026-08-18T12:00:03Z",
      lastError: null,
    }));
  });

  await recorder.step("Open the Import Rides page.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV containing a note of exactly 500 characters.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-notes-500.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Notes",
      `2024-05-01T08:00:00,10,${exact500}`,
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and confirm the row is valid.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 1 | Valid rows: 1 | Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();

  await recorder.step("Start the import and confirm the import completes successfully.");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_notes_exactly_500_characters");
  await recorder.save(testInfo);
});
