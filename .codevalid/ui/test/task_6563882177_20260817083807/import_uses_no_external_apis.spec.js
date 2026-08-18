import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCoreFeatureRoutes,
} from "../../helpers/mock-api.js";
import { setupRideImportScenario } from "../../helpers/ride-import-mock-api.js";

async function createCsvFile(name, content) {
  const filePath = path.join(os.tmpdir(), `${Date.now()}-${name}`);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Import workflow performs no network requests to external services", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_uses_no_external_apis",
    testTitle: "Import workflow performs no network requests to external services",
  });

  const externalRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/api/") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
      externalRequests.push(url);
    }
    if (/open-meteo|eia|analytics|telemetry|segment|sentry/i.test(url)) {
      externalRequests.push(url);
    }
  });

  await recorder.step("Register authenticated session and duplicate import scenario");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "duplicate_complete_after_resolution" });

  await recorder.step("Run the import workflow through duplicate resolution");
  await page.goto("/rides/import");
  const csvPath = await createCsvFile(
    "external-check.csv",
    "date,miles,notes\n2026-08-01,12.0,Duplicate commute\n"
  );
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await page.getByRole("button", { name: "Start Import" }).click();
  await page.getByLabel(/Row 2 keep existing/i).check();
  await page.getByRole("button", { name: "Start Import" }).click();

  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(externalRequests).toEqual([]);

  console.log("CODEVALID_TEST_ASSERTION_OK:import_uses_no_external_apis");
  await recorder.save(testInfo);
});
