import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Row with Miles ≤ 0 is rejected and flagged as invalid", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_negative_miles_rejected", "Row with Miles ≤ 0 is rejected and flagged as invalid");

  await recorder.step("Seed authenticated session and non-positive miles preview scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 102,
        totalMonthRows: 3,
        validMonthRows: 1,
        invalidMonthRows: 2,
        totalGeneratedRides: 7,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "January",
            year: 2024,
            totalMiles: 0,
            days: 5,
            isValid: false,
            errors: [{ rowNumber: 1, code: "invalid-miles", message: "Miles must be greater than 0", field: "miles" }],
            generatedRides: []
          },
          {
            rowNumber: 2,
            rawMonth: "February",
            year: 2024,
            totalMiles: -50,
            days: 3,
            isValid: false,
            errors: [{ rowNumber: 2, code: "invalid-miles", message: "Miles must be greater than 0", field: "miles" }],
            generatedRides: []
          },
          {
            rowNumber: 3,
            rawMonth: "March",
            year: 2024,
            totalMiles: 150,
            days: 7,
            isValid: true,
            errors: [],
            generatedRides: Array.from({ length: 7 }, (_, index) => ({ rideIndex: index + 1, date: `2024-03-${String(index + 4).padStart(2, "0")}`, miles: 21.42, isDuplicate: false, duplicateMatches: [] }))
          }
        ]
      }
    });
  });

  await recorder.step("Paste dataset and preview", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("Month,Miles,Days\nJanuary,0,5\nFebruary,-50,3\nMarch,150,7");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify invalid rows are flagged", async () => {
    await expect(page.getByText("Miles must be greater than 0")).toHaveCount(2);
    await expect(page.getByText("March")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_negative_miles_rejected");
  await recorder.save(testInfo);
});
