import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { emptyDataRowsCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Empty CSV file (no rows) is rejected with appropriate message", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_empty_file", "Empty CSV file (no rows) is rejected with appropriate message");

  await recorder.step("Seed authenticated session and preview failure response");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewError: {
      status: 400,
      body: { message: "No data rows found. CSV must contain at least one data row." },
    },
  });

  const filePath = await writeCsvFile("empty-data-rows.csv", emptyDataRowsCsv);

  await recorder.step("Upload header-only CSV and verify visible alert");
  await page.goto("/rides/import");
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("alert")).toContainText("No data rows found. CSV must contain at least one data row.");

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_empty_file");
  await recorder.save(testInfo);
});
