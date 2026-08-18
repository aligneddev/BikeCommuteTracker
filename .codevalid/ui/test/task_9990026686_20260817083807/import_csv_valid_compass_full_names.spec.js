import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_valid_compass_full_names", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_valid_compass_full_names",
    testTitle: "CSV full compass names are accepted and imported",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 106,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2024-05-01T08:00:00",
          miles: 15,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: null,
          isValid: true,
          errors: [],
          duplicateMatches: [],
        },
      ],
    }));
  });

  await page.route("**/api/imports/start", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 106,
      status: "processing",
      startedAtUtc: "2026-08-18T12:00:01Z",
    }));
  });

  await page.route("**/api/imports/106/status", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 106,
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

  await recorder.step("Go to Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV using a full compass name like Southeast.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-full-direction-name.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,PrimaryTravelDirection",
      "2024-05-01T08:00:00,15,Southeast",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and confirm the row is valid.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 1 | Valid rows: 1 | Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();

  await recorder.step("Start import and verify successful completion.");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_valid_compass_full_names");
  await recorder.save(testInfo);
});
