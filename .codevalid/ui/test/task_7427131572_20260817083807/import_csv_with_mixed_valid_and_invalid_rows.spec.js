import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { mixedValidInvalidRowsCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV with mixed valid and invalid rows processes valid rows and reports per-row errors", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_mixed_valid_and_invalid_rows", "CSV with mixed valid and invalid rows processes valid rows and reports per-row errors");

  await recorder.step("Seed authenticated session and mixed-result preview mock");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 1001,
      totalRows: 5,
      validRows: 3,
      invalidRows: 2,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        { rowNumber: 1, date: "2023-10-01", miles: 5, isValid: true, errors: [], duplicateMatches: [] },
        { rowNumber: 2, date: "2023-10-02", miles: 6, isValid: true, errors: [], duplicateMatches: [] },
        { rowNumber: 3, date: "2023-10-03", miles: 7, isValid: true, errors: [], duplicateMatches: [] },
        {
          rowNumber: 4,
          date: "2023-10-04",
          miles: 8,
          isValid: false,
          errors: [{ rowNumber: 4, code: "difficulty_range", field: "Difficulty", message: "Difficulty must be an integer between 1 and 5." }],
          duplicateMatches: [],
        },
        {
          rowNumber: 5,
          date: "2023-10-05",
          miles: 9,
          isValid: false,
          errors: [{ rowNumber: 5, code: "direction_invalid", field: "Direction", message: "Direction must be one of: N, NE, E, SE, S, SW, W, NW, North, Northeast, East, Southeast, South, Southwest, West, Northwest." }],
          duplicateMatches: [],
        },
      ],
    },
  });

  const filePath = await writeCsvFile("mixed-valid-invalid-rows.csv", mixedValidInvalidRowsCsv);

  await recorder.step("Upload CSV and verify per-row results");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 5 | Valid rows: 3 | Invalid rows: 2")).toBeVisible();
  await expect(page.getByText("Row 4: Invalid")).toBeVisible();
  await expect(page.getByText("Row 5: Invalid")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be an integer between 1 and 5.")).toBeVisible();
  await expect(page.getByText("Direction: Direction must be one of: N, NE, E, SE, S, SW, W, NW, North, Northeast, East, Southeast, South, Southwest, West, Northwest.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_mixed_valid_and_invalid_rows");
  await recorder.save(testInfo);
});
