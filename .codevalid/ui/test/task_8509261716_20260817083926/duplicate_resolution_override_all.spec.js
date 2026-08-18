import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("User uses 'Override All Duplicates' to replace all colliding dates in bulk", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("duplicate_resolution_override_all", "User uses 'Override All Duplicates' to replace all colliding dates in bulk");

  await recorder.step("Seed authenticated session and multi-duplicate scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 115,
        totalMonthRows: 2,
        validMonthRows: 2,
        invalidMonthRows: 0,
        totalGeneratedRides: 7,
        duplicateRides: 2,
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
              { rideIndex: 1, date: "2024-01-10", miles: 20, isDuplicate: true, duplicateMatches: [{ existingRideId: 88, existingRideDate: "2024-01-10", existingMiles: 15 }] },
              { rideIndex: 2, date: "2024-01-18", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 3, date: "2024-01-26", miles: 20, isDuplicate: false, duplicateMatches: [] }
            ]
          },
          {
            rowNumber: 2,
            rawMonth: "February",
            year: 2024,
            totalMiles: 70,
            days: 4,
            isValid: true,
            errors: [],
            generatedRides: [
              { rideIndex: 4, date: "2024-02-07", miles: 17.5, isDuplicate: true, duplicateMatches: [{ existingRideId: 89, existingRideDate: "2024-02-07", existingMiles: 18 }] },
              { rideIndex: 5, date: "2024-02-13", miles: 17.5, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 6, date: "2024-02-19", miles: 17.5, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 7, date: "2024-02-27", miles: 17.5, isDuplicate: false, duplicateMatches: [] }
            ]
          }
        ]
      },
      startResponse: { importJobId: 115, status: "processing", startedAtUtc: "2026-08-17T08:39:00Z" },
      statusSequence: [
        { importJobId: 115, status: "completed", totalRows: 7, processedRows: 7, importedRows: 7, skippedRows: 0, failedRows: 0, percentComplete: 100, etaMinutesRounded: 0, createdAtUtc: "2026-08-17T08:39:00Z", completedAtUtc: "2026-08-17T08:39:02Z" }
      ]
    });
  });

  await recorder.step("Preview duplicates and enable override all", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,60,3\nFebruary,70,4");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
    await page.getByLabel("Override all duplicates").check();
    await page.getByRole("button", { name: "Start Import" }).click();
  });

  await recorder.step("Verify bulk override completed", async () => {
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toBeVisible();
    await expect(page.getByText("Rides created: 7")).toBeVisible();
    await expect(page.getByText("Rides skipped: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_resolution_override_all");
  await recorder.save(testInfo);
});
