import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupCsvImportScenario } from "../../helpers/mock-api.js";
import { invalidHeadersCsv } from "../../mock/mock-data.js";

async function writeCsvFile(fileName, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-import-"));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("CSV with invalid or missing mandatory headers fails with clear error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_csv_with_invalid_headers", "CSV with invalid or missing mandatory headers fails with clear error");

  await recorder.step("Seed authenticated session and header validation failure response");
  await setupAuthenticatedSession(page);
  await setupCsvImportScenario(page, {
    previewError: {
      status: 400,
      body: { message: "Missing required column: Miles. Required columns: Date, Miles." },
    },
  });
  
  const filePath = await writeCsvFile("invalid-headers.csv", invalidHeadersCsv);

  await recorder.step("Upload CSV with invalid headers and verify error plus sample CSV affordance");
  await page.goto("/rides/import");
  await expect(page.getByRole("button", { name: "Download sample CSV" })).toBeVisible();
  await page.locator("#csv-upload-input").setInputFiles(filePath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("alert")).toContainText("Missing required column: Miles. Required columns: Date, Miles.");

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_invalid_headers");
  await recorder.save(testInfo);
});
