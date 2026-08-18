import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("Ride import resumes successfully after connectivity restoration", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_rides_retry_after_online", "Ride import resumes successfully after connectivity restoration");
  let healthAttempts = 0;

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Fail startup health once, then recover on retry", async () => {
    await page.route("**/health", async (route) => {
      healthAttempts += 1;
      if (healthAttempts <= 20) {
        await route.abort("failed");
        return;
      }
      await json(route, 200, { status: "ok" });
    });
  });

  await recorder.step("Mock import APIs for recovered online flow", async () => {
    await page.route("**/api/import/csv/preview", async (route) => {
      await json(route, 200, {
        importJobId: 321,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [
          {
            rowNumber: 1,
            isValid: true,
            duplicateMatches: [],
            errors: [],
          },
        ],
      });
    });

    await page.route("**/api/import/csv/start", async (route) => {
      await json(route, 200, { importJobId: 321 });
    });

    await page.route(/.*\/api\/import\/csv\/status\/321$/, async (route) => {
      await json(route, 200, {
        importJobId: 321,
        status: "processing",
        totalRows: 1,
        processedRows: 1,
        importedRows: 1,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 100,
        etaMinutesRounded: 0,
        createdAtUtc: "2026-08-18T12:00:00Z",
        startedAtUtc: "2026-08-18T12:00:10Z",
        completedAtUtc: null,
        lastError: null,
      });
    });
  });

  await recorder.step("Open app and wait for blocked startup state", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
  });

  await recorder.step("Retry after connectivity is restored", async () => {
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  await recorder.step("Select import file and verify selection is retained into import flow", async () => {
    await page.setInputFiles("#csv-upload-input", {
      name: "rides.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("date,miles\n2026-08-18,5.2\n"),
    });
    await expect(page.getByText("Selected file: rides.csv")).toBeVisible();
  });

  await recorder.step("Preview and start import successfully after retry", async () => {
    await page.getByRole("button", { name: "Preview Import" }).click();
    await expect(page.getByText(/Total rows: 1 \| Valid rows: 1 \| Invalid rows: 0/)).toBeVisible();
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rides_retry_after_online");
  await recorder.save(testInfo);
});
