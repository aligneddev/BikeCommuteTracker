import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { caseInsensitiveDirectionsCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV import normalizes direction values with mixed case correctly", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_case_insensitive_directions", "CSV import normalizes direction values with mixed case correctly");

  await recorder.step("Seed authenticated session and successful import mocks");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 601,
      totalRows: 3,
      validRows: 3,
      invalidRows: 0,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        { rowNumber: 1, date: "2023-10-01", miles: 4, isValid: true, errors: [], duplicateMatches: [] },
        { rowNumber: 2, date: "2023-10-02", miles: 5, isValid: true, errors: [], duplicateMatches: [] },
        { rowNumber: 3, date: "2023-10-03", miles: 6, isValid: true, errors: [], duplicateMatches: [] },
      ],
    },
    startResponse: { importJobId: 601, status: "processing", startedAtUtc: "2026-01-01T02:00:00.000Z" },
    statusResponse: {
      importJobId: 601,
      status: "completed",
      totalRows: 3,
      processedRows: 3,
      importedRows: 3,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 100,
      etaMinutesRounded: null,
      createdAtUtc: "2026-01-01T02:00:00.000Z",
      startedAtUtc: "2026-01-01T02:00:01.000Z",
      completedAtUtc: "2026-01-01T02:00:03.000Z",
      lastError: null,
    },
  });

  const filePath = await writeCsvFile("case-insensitive-directions.csv", caseInsensitiveDirectionsCsv);

  await recorder.step("Upload CSV and preview valid rows");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 3 | Valid rows: 3 | Invalid rows: 0")).toBeVisible();

  await recorder.step("Start import and verify completed import count");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 3 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_case_insensitive_directions");
  await recorder.save(testInfo);
});
