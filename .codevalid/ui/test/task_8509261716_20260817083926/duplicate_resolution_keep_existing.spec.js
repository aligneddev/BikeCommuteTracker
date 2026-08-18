import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("User chooses 'Keep Existing' to skip creating duplicate ride", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("duplicate_resolution_keep_existing", "User chooses 'Keep Existing' to skip creating duplicate ride");

  await recorder.step("Seed authenticated session and keep-existing import flow", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 113,
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
      startResponse: { importJobId: 113, status: "processing", startedAtUtc: "2026-08-17T08:39:00Z" },
      statusSequence: [
        { importJobId: 113, status: "completed", totalRows: 3, processedRows: 3, importedRows: 2, skippedRows: 1, failedRows: 0, percentComplete: 100, etaMinutesRounded: 0, createdAtUtc: "2026-08-17T08:39:00Z", completedAtUtc: "2026-08-17T08:39:02Z" }
      ]
    });
  });

  await recorder.step("Preview duplicate and choose keep existing", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,60,3");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
    await page.getByLabel("Row 2 keep existing").check();
    await page.getByRole("button", { name: "Start Import" }).click();
  });

  await recorder.step("Verify summary shows one skipped ride", async () => {
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toBeVisible();
    await expect(page.getByText("Rides skipped: 1")).toBeVisible();
    await expect(page.getByText("Rides created: 2")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_resolution_keep_existing");
  await recorder.save(testInfo);
});
