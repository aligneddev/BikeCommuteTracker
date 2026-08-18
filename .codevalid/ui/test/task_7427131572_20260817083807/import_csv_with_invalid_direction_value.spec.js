import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { invalidDirectionCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Row with unrecognized direction (e.g., 'Up', 'Northwest') is rejected with accepted values list", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_invalid_direction_value", "Row with unrecognized direction (e.g., 'Up', 'Northwest') is rejected with accepted values list");

  await recorder.step("Seed authenticated session and preview with direction errors");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewResponse: {
      importJobId: 501,
      totalRows: 2,
      validRows: 0,
      invalidRows: 2,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2023-10-01",
          miles: 10,
          isValid: false,
          errors: [{ rowNumber: 1, code: "direction_invalid", field: "Direction", message: "Direction must be one of: N, NE, E, SE, S, SW, W, NW, North, Northeast, East, Southeast, South, Southwest, West, Northwest." }],
          duplicateMatches: [],
        },
        {
          rowNumber: 2,
          date: "2023-10-02",
          miles: 11,
          isValid: false,
          errors: [{ rowNumber: 2, code: "direction_invalid", field: "Direction", message: "Direction must be one of: N, NE, E, SE, S, SW, W, NW, North, Northeast, East, Southeast, South, Southwest, West, Northwest." }],
          duplicateMatches: [],
        },
      ],
    },
  });

  const filePath = await writeCsvFile("invalid-direction.csv", invalidDirectionCsv);

  await recorder.step("Upload CSV and verify accepted-values error message");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 0 | Invalid rows: 2")).toBeVisible();
  await expect(page.getByText("Direction: Direction must be one of: N, NE, E, SE, S, SW, W, NW, North, Northeast, East, Southeast, South, Southwest, West, Northwest.")).toHaveCount(2);

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_invalid_direction_value");
  await recorder.save(testInfo);
});
