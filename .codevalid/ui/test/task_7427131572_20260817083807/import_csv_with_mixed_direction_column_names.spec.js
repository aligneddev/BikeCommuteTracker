import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import {
  directionColumnCsv,
  primaryTravelDirectionColumnCsv,
} from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV import accepts either PrimaryTravelDirection or Direction column name", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_mixed_direction_column_names", "CSV import accepts either PrimaryTravelDirection or Direction column name");

  await recorder.step("Seed authenticated session and import mocks for two preview/start cycles");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewSequence: [
      {
        importJobId: 201,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [{ rowNumber: 1, date: "2023-10-01", miles: 10.5, isValid: true, errors: [], duplicateMatches: [] }],
      },
      {
        importJobId: 202,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [{ rowNumber: 1, date: "2023-10-02", miles: 8.2, isValid: true, errors: [], duplicateMatches: [] }],
      },
    ],
    startSequence: [
      { importJobId: 201, status: "processing", startedAtUtc: "2026-01-01T00:00:00.000Z" },
      { importJobId: 202, status: "processing", startedAtUtc: "2026-01-01T00:10:00.000Z" },
    ],
    statusMap: {
      201: {
        importJobId: 201,
        status: "completed",
        totalRows: 1,
        processedRows: 1,
        importedRows: 1,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 100,
        etaMinutesRounded: null,
        createdAtUtc: "2026-01-01T00:00:00.000Z",
        startedAtUtc: "2026-01-01T00:00:01.000Z",
        completedAtUtc: "2026-01-01T00:00:03.000Z",
        lastError: null,
      },
      202: {
        importJobId: 202,
        status: "completed",
        totalRows: 1,
        processedRows: 1,
        importedRows: 1,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 100,
        etaMinutesRounded: null,
        createdAtUtc: "2026-01-01T00:10:00.000Z",
        startedAtUtc: "2026-01-01T00:10:01.000Z",
        completedAtUtc: "2026-01-01T00:10:03.000Z",
        lastError: null,
      },
    },
  });

  const directionFile = await writeCsvFile("direction-column.csv", directionColumnCsv);
  const primaryDirectionFile = await writeCsvFile("primary-direction-column.csv", primaryTravelDirectionColumnCsv);

  await recorder.step("Open Import Rides page");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Upload CSV using Direction column and complete import");
  await page.locator("#csv-upload-input").setInputFiles(directionFile);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  await recorder.step("Reload page and upload CSV using PrimaryTravelDirection column");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(primaryDirectionFile);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_mixed_direction_column_names");
  await recorder.save(testInfo);
});
