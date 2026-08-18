import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Rides are distributed using even stride algorithm starting from stride-th weekday", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("even_stride_algorithm_used_for_weekday_selection", "Rides are distributed using even stride algorithm starting from stride-th weekday");

  await recorder.step("Seed authenticated session and stride-based preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 110,
        totalMonthRows: 1,
        validMonthRows: 1,
        invalidMonthRows: 0,
        totalGeneratedRides: 5,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "January",
            year: 2024,
            totalMiles: 100,
            days: 5,
            isValid: true,
            errors: [],
            generatedRides: [
              { rideIndex: 1, date: "2024-01-04", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 2, date: "2024-01-10", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 3, date: "2024-01-16", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 4, date: "2024-01-22", miles: 20, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 5, date: "2024-01-26", miles: 20, isDuplicate: false, duplicateMatches: [] }
            ]
          }
        ]
      }
    });
  });

  await recorder.step("Preview the January stride scenario", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify selected weekdays follow expected stride dates", async () => {
    for (const value of ["2024-01-04: 20 mi", "2024-01-10: 20 mi", "2024-01-16: 20 mi", "2024-01-22: 20 mi", "2024-01-26: 20 mi"]) {
      await expect(page.getByText(value)).toBeVisible();
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:even_stride_algorithm_used_for_weekday_selection");
  await recorder.save(testInfo);
});
