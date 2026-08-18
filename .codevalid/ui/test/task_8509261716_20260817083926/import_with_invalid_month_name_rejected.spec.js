import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Invalid month name in input is detected and rejected with error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_invalid_month_name_rejected", "Invalid month name in input is detected and rejected with error");

  await recorder.step("Seed authenticated session and invalid-month preview scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 101,
        totalMonthRows: 2,
        validMonthRows: 1,
        invalidMonthRows: 1,
        totalGeneratedRides: 5,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "Mars",
            year: null,
            totalMiles: 100,
            days: 5,
            isValid: false,
            errors: [
              { rowNumber: 1, code: "invalid-month", message: "Invalid month name: Mars", field: "month" }
            ],
            generatedRides: []
          },
          {
            rowNumber: 2,
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

  await recorder.step("Load page and paste invalid month dataset", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("Month,Miles,Days\nMars,100,5\nJanuary,100,5");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify invalid month is rejected and start import remains disabled", async () => {
    await expect(page.getByText("Invalid month name: Mars")).toBeVisible();
    await expect(page.getByText("Mars")).toBeVisible();
    await expect(page.getByText("January")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_invalid_month_name_rejected");
  await recorder.save(testInfo);
});
