import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { blankOptionalFieldsCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV import succeeds when Difficulty or Direction fields are blank or missing", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_blank_difficulty_or_direction", "CSV import succeeds when Difficulty or Direction fields are blank or missing");

  await recorder.step("Seed authenticated session and import mocks");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 301,
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        { rowNumber: 1, date: "2023-10-01", miles: 5, isValid: true, errors: [], duplicateMatches: [] },
        { rowNumber: 2, date: "2023-10-02", miles: 7.2, isValid: true, errors: [], duplicateMatches: [] },
      ],
    },
    startResponse: {
      importJobId: 301,
      status: "processing",
      startedAtUtc: "2026-01-01T01:00:00.000Z",
    },
    statusResponse: {
      importJobId: 301,
      status: "completed",
      totalRows: 2,
      processedRows: 2,
      importedRows: 2,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 100,
      etaMinutesRounded: null,
      createdAtUtc: "2026-01-01T01:00:00.000Z",
      startedAtUtc: "2026-01-01T01:00:01.000Z",
      completedAtUtc: "2026-01-01T01:00:03.000Z",
      lastError: null,
    },
  });

  const filePath = await writeCsvFile("blank-optional-fields.csv", blankOptionalFieldsCsv);

  await recorder.step("Open page, upload CSV, and preview import");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 2 | Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();
  await expect(page.getByText("Row 2: Valid")).toBeVisible();

  await recorder.step("Start import and verify both rows imported");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 2 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_blank_difficulty_or_direction");
  await recorder.save(testInfo);
});
