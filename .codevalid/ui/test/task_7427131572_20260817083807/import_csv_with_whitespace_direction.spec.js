import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { whitespaceDirectionCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV import trims whitespace and normalizes direction values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_whitespace_direction", "CSV import trims whitespace and normalizes direction values");

  await recorder.step("Seed authenticated session and successful import mocks");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 701,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [{ rowNumber: 1, date: "2023-10-01", miles: 8, isValid: true, errors: [], duplicateMatches: [] }],
    },
    startResponse: { importJobId: 701, status: "processing", startedAtUtc: "2026-01-01T03:00:00.000Z" },
    statusResponse: {
      importJobId: 701,
      status: "completed",
      totalRows: 1,
      processedRows: 1,
      importedRows: 1,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 100,
      etaMinutesRounded: null,
      createdAtUtc: "2026-01-01T03:00:00.000Z",
      startedAtUtc: "2026-01-01T03:00:01.000Z",
      completedAtUtc: "2026-01-01T03:00:03.000Z",
      lastError: null,
    },
  });

  const filePath = await writeCsvFile("whitespace-direction.csv", whitespaceDirectionCsv);

  await recorder.step("Upload CSV and preview import");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();

  await recorder.step("Start import and verify success summary");
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByText("Nice work. 1 rides were imported successfully.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_whitespace_direction");
  await recorder.save(testInfo);
});
