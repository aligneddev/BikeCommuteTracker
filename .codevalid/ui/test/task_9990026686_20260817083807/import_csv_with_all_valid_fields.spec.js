import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function buildPreviewResponse(overrides = {}) {
  return {
    importJobId: 101,
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    duplicateRows: 0,
    requiresDuplicateResolution: false,
    rows: [
      {
        rowNumber: 1,
        date: "2024-05-01T08:00:00",
        miles: 15.2,
        rideMinutes: 42,
        temperature: 65,
        tags: null,
        notes: "Great ride!",
        isValid: true,
        errors: [],
        duplicateMatches: [],
      },
    ],
    ...overrides,
  };
}

function buildStartedStatus(importJobId, overrides = {}) {
  return {
    importJobId,
    status: "processing",
    totalRows: 1,
    processedRows: 1,
    importedRows: 1,
    skippedRows: 0,
    failedRows: 0,
    percentComplete: 100,
    etaMinutesRounded: 0,
    createdAtUtc: "2026-08-18T12:00:00Z",
    startedAtUtc: "2026-08-18T12:00:01Z",
    completedAtUtc: null,
    lastError: null,
    ...overrides,
  };
}

function buildCompletedStatus(importJobId, overrides = {}) {
  return {
    importJobId,
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
    ...overrides,
  };
}

async function mockSampleCsvDownload(page, csvText) {
  await page.route("**/api/rides/csv-sample", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: csvText,
    });
  });
}

async function mockImportFlow(page, { previewResponse, startResponse, statusResponse }) {
  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, previewResponse));
  });

  await page.route("**/api/imports/start", async (route) => {
    await route.fulfill(jsonResponse(200, startResponse));
  });

  await page.route(`**/api/imports/${previewResponse.importJobId}/status`, async (route) => {
    await route.fulfill(jsonResponse(200, statusResponse));
  });
}

test("import_csv_with_all_valid_fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_with_all_valid_fields",
    testTitle: "Valid CSV with all optional fields imported successfully",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const sampleCsv = [
    "# Valid Difficulty: 1–5. Accepted Directions: N, NE, E, SE, S, SW, W, NW or full names. Notes ≤ 500 chars.",
    "Date,Miles,Minutes,Temperature,WindSpeed,PrimaryTravelDirection,Difficulty,Notes",
    '2024-05-01T08:00:00,15.2,42,65,8,N,3,"Great ride!"',
  ].join("\n");

  const previewResponse = buildPreviewResponse();
  const startResponse = {
    importJobId: 101,
    status: "processing",
    startedAtUtc: "2026-08-18T12:00:01Z",
  };
  const statusResponse = buildCompletedStatus(101);

  await mockSampleCsvDownload(page, sampleCsv);
  await mockImportFlow(page, {
    previewResponse,
    startResponse,
    statusResponse,
  });

  await recorder.step("Navigate to authenticated import rides page.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Download the sample CSV and verify its legend and supported columns.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ride-import-sample.csv");
  const downloadedText = await download.path().then(async (filePath) => {
    const fs = await import("node:fs/promises");
    return fs.readFile(filePath, "utf8");
  });
  expect(downloadedText).toContain("# Valid Difficulty: 1–5. Accepted Directions: N, NE, E, SE, S, SW, W, NW or full names. Notes ≤ 500 chars.");
  expect(downloadedText).toContain("Date,Miles,Minutes,Temperature,WindSpeed,PrimaryTravelDirection,Difficulty,Notes");

  await recorder.step("Upload a valid CSV containing Difficulty=3, direction N, and a valid note.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-valid-all-fields.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(sampleCsv, "utf8"),
  });
  await expect(page.getByText("Selected file: rides-valid-all-fields.csv")).toBeVisible();

  await recorder.step("Preview the import and verify the row is marked valid.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 1 | Valid rows: 1 | Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();

  await recorder.step("Start the import and verify completion with one imported ride and no errors.");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();
  await expect(page.getByText("Row 1:")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_all_valid_fields");
  await recorder.save(testInfo);
});
