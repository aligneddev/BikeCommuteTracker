import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("All months assigned to single selected year when within one calendar year", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_single_year_assignment", "All months assigned to single selected year when within one calendar year");

  await recorder.step("Seed authenticated session and single-year preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 107,
        totalMonthRows: 3,
        validMonthRows: 3,
        invalidMonthRows: 0,
        totalGeneratedRides: 18,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          { rowNumber: 1, rawMonth: "January", year: 2024, totalMiles: 100, days: 5, isValid: true, errors: [], generatedRides: [{ rideIndex: 1, date: "2024-01-04", miles: 20, isDuplicate: false, duplicateMatches: [] }] },
          { rowNumber: 2, rawMonth: "June", year: 2024, totalMiles: 120, days: 6, isValid: true, errors: [], generatedRides: [{ rideIndex: 2, date: "2024-06-05", miles: 20, isDuplicate: false, duplicateMatches: [] }] },
          { rowNumber: 3, rawMonth: "December", year: 2024, totalMiles: 150, days: 7, isValid: true, errors: [], generatedRides: [{ rideIndex: 3, date: "2024-12-06", miles: 21.42, isDuplicate: false, duplicateMatches: [] }] }
        ]
      }
    });
  });

  await recorder.step("Preview single-year dataset", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5\nJune,120,6\nDecember,150,7");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify all generated dates are in 2024", async () => {
    await expect(page.getByText("2024-01-04: 20 mi")).toBeVisible();
    await expect(page.getByText("2024-06-05: 20 mi")).toBeVisible();
    await expect(page.getByText("2024-12-06: 21.42 mi")).toBeVisible();
    await expect(page.getByText("2025-")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_single_year_assignment");
  await recorder.save(testInfo);
});
