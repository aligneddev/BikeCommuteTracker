import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { invalidDifficultyRangeCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Row with invalid Difficulty (e.g., 0, 6, 'high') is rejected with specific error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_invalid_difficulty_outside_range", "Row with invalid Difficulty (e.g., 0, 6, 'high') is rejected with specific error");

  await recorder.step("Seed authenticated session and preview with row-level difficulty errors");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 401,
      totalRows: 3,
      validRows: 1,
      invalidRows: 2,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        { rowNumber: 1, date: "2023-10-01", miles: 12, isValid: true, errors: [], duplicateMatches: [] },
        {
          rowNumber: 2,
          date: "2023-10-02",
          miles: 9,
          isValid: false,
          errors: [{ rowNumber: 2, code: "difficulty_range", field: "Difficulty", message: "Difficulty must be an integer between 1 and 5." }],
          duplicateMatches: [],
        },
        {
          rowNumber: 3,
          date: "2023-10-03",
          miles: 6,
          isValid: false,
          errors: [{ rowNumber: 3, code: "difficulty_range", field: "Difficulty", message: "Difficulty must be an integer between 1 and 5." }],
          duplicateMatches: [],
        },
      ],
    },
  });

  const filePath = await writeCsvFile("invalid-difficulty-range.csv", invalidDifficultyRangeCsv);

  await recorder.step("Open page, upload CSV, and inspect preview errors");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 3 | Valid rows: 1 | Invalid rows: 2")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();
  await expect(page.getByText("Row 2: Invalid")).toBeVisible();
  await expect(page.getByText("Row 3: Invalid")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be an integer between 1 and 5.")).toHaveCount(2);

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_invalid_difficulty_outside_range");
  await recorder.save(testInfo);
});
