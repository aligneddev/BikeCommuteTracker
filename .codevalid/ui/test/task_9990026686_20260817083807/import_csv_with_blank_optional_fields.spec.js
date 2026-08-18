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

async function mockImport(page, { previewResponse, statusResponse }) {
  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, previewResponse));
  });
  await page.route("**/api/imports/start", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: previewResponse.importJobId,
      status: "processing",
      startedAtUtc: "2026-08-18T12:00:01Z",
    }));
  });
  await page.route(`**/api/imports/${previewResponse.importJobId}/status`, async (route) => {
    await route.fulfill(jsonResponse(200, statusResponse));
  });
}

test("import_csv_with_blank_optional_fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_with_blank_optional_fields",
    testTitle: "CSV with missing optional fields imports successfully",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const csvText = [
    "Date,Miles,Difficulty,PrimaryTravelDirection,Notes",
    "2024-05-01T08:00:00,15.2,,,",
  ].join("\n");

  const previewResponse = {
    importJobId: 102,
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
        rideMinutes: null,
        temperature: null,
        tags: null,
        notes: "",
        isValid: true,
        errors: [],
        duplicateMatches: [],
      },
    ],
  };

  const statusResponse = {
    importJobId: 102,
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
  };

  await mockImport(page, { previewResponse, statusResponse });

  await recorder.step("Open the import page as an authenticated rider.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Upload a CSV whose optional Difficulty, direction, and note fields are blank.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-blank-optional-fields.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvText, "utf8"),
  });

  await recorder.step("Preview the file and verify the row remains valid.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 1 | Valid rows: 1 | Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();

  await recorder.step("Start the import and verify one ride imports successfully.");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_blank_optional_fields");
  await recorder.save(testInfo);
});
