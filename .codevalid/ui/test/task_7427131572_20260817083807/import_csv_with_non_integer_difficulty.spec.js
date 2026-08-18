import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { nonIntegerDifficultyCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Row with non-integer Difficulty (e.g., string, decimal) is rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_non_integer_difficulty", "Row with non-integer Difficulty (e.g., string, decimal) is rejected");

  await recorder.step("Seed authenticated session and preview error mock");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 801,
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2023-10-01",
          miles: 10,
          isValid: false,
          errors: [{ rowNumber: 1, code: "difficulty_integer", field: "Difficulty", message: "Difficulty must be an integer between 1 and 5." }],
          duplicateMatches: [],
        },
      ],
    },
  });

  const filePath = await writeCsvFile("non-integer-difficulty.csv", nonIntegerDifficultyCsv);

  await recorder.step("Upload CSV and verify preview rejection");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 1 | Valid rows: 0 | Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be an integer between 1 and 5.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_non_integer_difficulty");
  await recorder.save(testInfo);
});
