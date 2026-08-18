import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("User chooses 'Replace with Import' to overwrite existing ride", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("duplicate_resolution_replace_with_import", "User chooses 'Replace with Import' to overwrite existing ride");

  await recorder.step("Seed authenticated session and replace import flow", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 114,
        totalMonthRows: 1,
        validMonthRows: 1,
        invalidMonthRows: 0,
        totalGeneratedRides: 3,
        duplicateRides: 1,
        requiresDuplicateResolution: true,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "January",
            year: 2024,
            totalMiles: 60,
            days: 3,
            isValid: true,
            errors: [],
            generatedRides: [
              { rideIndex: 1, date: "2024-01-05", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 2, date: "2024-01-15", miles: 20, isDuplicate: true, duplicateMatches: [{ existingRideId: 77, existingRideDate: "2024-01-15", existingMiles: 50 }] },
              { rideIndex: 3, date: "2024-01-25", miles: 20, isDuplicate: false, duplicateMatches: [] }
            ]
          }
        ]
      },
      startResponse: { importJobId: 114, status: "processing", startedAtUtc: "2026-08-17T08:39:00Z" },
      statusSequence: [
        { importJobId: 114, status: "completed", totalRows: 3, processedRows: 3, importedRows: 3, skippedRows: 0, failedRows: 0, percentComplete: 100, etaMinutesRounded: 0, createdAtUtc: "2026-08-17T08:39:00Z", completedAtUtc: "2026-08-17T08:39:02Z" }
      ]
    });
  });

  await recorder.step("Preview duplicate and choose replace with import", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,60,3");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
    await page.getByLabel("Row 2 replace with import").check();
    await page.getByRole("button", { name: "Start Import" }).click();
  });

  await recorder.step("Verify import completes without skips", async () => {
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toBeVisible();
    await expect(page.getByText("Rides created: 3")).toBeVisible();
    await expect(page.getByText("Rides skipped: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_resolution_replace_with_import");
  await recorder.save(testInfo);
});
