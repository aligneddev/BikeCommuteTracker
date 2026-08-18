import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Months spanning year boundary correctly assign to starting and next year", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_year_boundary_assignment", "Months spanning year boundary correctly assign to starting and next year");

  await recorder.step("Seed authenticated session and boundary-year preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 108,
        totalMonthRows: 4,
        validMonthRows: 4,
        invalidMonthRows: 0,
        totalGeneratedRides: 20,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          { rowNumber: 1, rawMonth: "November", year: 2024, totalMiles: 100, days: 4, isValid: true, errors: [], generatedRides: [{ rideIndex: 1, date: "2024-11-08", miles: 25, isDuplicate: false, duplicateMatches: [] }] },
          { rowNumber: 2, rawMonth: "December", year: 2024, totalMiles: 120, days: 5, isValid: true, errors: [], generatedRides: [{ rideIndex: 2, date: "2024-12-06", miles: 24, isDuplicate: false, duplicateMatches: [] }] },
          { rowNumber: 3, rawMonth: "January", year: 2025, totalMiles: 130, days: 6, isValid: true, errors: [], generatedRides: [{ rideIndex: 3, date: "2025-01-06", miles: 21.66, isDuplicate: false, duplicateMatches: [] }] },
          { rowNumber: 4, rawMonth: "February", year: 2025, totalMiles: 110, days: 5, isValid: true, errors: [], generatedRides: [{ rideIndex: 4, date: "2025-02-07", miles: 22, isDuplicate: false, duplicateMatches: [] }] }
        ]
      }
    });
  });

  await recorder.step("Preview year-boundary dataset", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("November,100,4\nDecember,120,5\nJanuary,130,6\nFebruary,110,5");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify Nov/Dec use 2024 and Jan/Feb use 2025", async () => {
    await expect(page.getByText("2024-11-08: 25 mi")).toBeVisible();
    await expect(page.getByText("2024-12-06: 24 mi")).toBeVisible();
    await expect(page.getByText("2025-01-06: 21.66 mi")).toBeVisible();
    await expect(page.getByText("2025-02-07: 22 mi")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_year_boundary_assignment");
  await recorder.save(testInfo);
});
