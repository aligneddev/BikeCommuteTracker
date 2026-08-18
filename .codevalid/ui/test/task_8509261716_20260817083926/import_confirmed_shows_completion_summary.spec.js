import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("After confirmation, preview is replaced with inline completion summary panel", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_confirmed_shows_completion_summary", "After confirmation, preview is replaced with inline completion summary panel");

  await recorder.step("Seed authenticated session and successful completion scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 116,
        totalMonthRows: 2,
        validMonthRows: 2,
        invalidMonthRows: 0,
        totalGeneratedRides: 11,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          { rowNumber: 1, rawMonth: "January", year: 2024, totalMiles: 100, days: 5, isValid: true, errors: [], generatedRides: [] },
          { rowNumber: 2, rawMonth: "February", year: 2024, totalMiles: 120, days: 6, isValid: true, errors: [], generatedRides: [] }
        ]
      },
      startResponse: { importJobId: 116, status: "processing", startedAtUtc: "2026-08-17T08:39:00Z" },
      statusSequence: [
        { importJobId: 116, status: "completed", totalRows: 11, processedRows: 11, importedRows: 11, skippedRows: 0, failedRows: 0, percentComplete: 100, etaMinutesRounded: 0, createdAtUtc: "2026-08-17T08:39:00Z", completedAtUtc: "2026-08-17T08:39:02Z" }
      ]
    });
  });

  await recorder.step("Preview and start import", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5\nFebruary,120,6");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
  });

  await recorder.step("Verify summary replaces preview", async () => {
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toBeVisible();
    await expect(page.getByText("Months processed: 2")).toBeVisible();
    await expect(page.getByText("Rides created: 11")).toBeVisible();
    await expect(page.getByText("Rides replaced: 0")).toBeVisible();
    await expect(page.getByText("Rides skipped: 0")).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_confirmed_shows_completion_summary");
  await recorder.save(testInfo);
});
