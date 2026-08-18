import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Existing rides on same date show side-by-side comparison in preview", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("duplicate_ride_detected_with_side_by_side_comparison", "Existing rides on same date show side-by-side comparison in preview");

  await recorder.step("Seed authenticated session and duplicate preview scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 112,
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
      }
    });
  });

  await recorder.step("Preview duplicate ride dataset", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,60,3");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
  });

  await recorder.step("Verify side-by-side duplicate resolution details are shown", async () => {
    await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toBeVisible();
    await expect(page.getByText("Incoming ride: 2024-01-15 • 20.0 mi")).toBeVisible();
    await expect(page.getByText("Existing ride #77: 2024-01-15 • 50.0 mi")).toBeVisible();
    await expect(page.getByText("Row 2 keep existing")).toBeVisible();
    await expect(page.getByText("Row 2 replace with import")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_ride_detected_with_side_by_side_comparison");
  await recorder.save(testInfo);
});
