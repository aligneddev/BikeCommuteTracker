import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Duplicate months within the same file are rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_intrafile_duplicate_months_rejected", "Duplicate months within the same file are rejected");

  await recorder.step("Seed authenticated session and duplicate-month preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 104,
        totalMonthRows: 3,
        validMonthRows: 1,
        invalidMonthRows: 2,
        totalGeneratedRides: 6,
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
            isValid: false,
            errors: [{ rowNumber: 1, code: "duplicate-month", message: "Duplicate month found: January", field: "month" }],
            generatedRides: []
          },
          {
            rowNumber: 2,
            rawMonth: "February",
            year: 2024,
            totalMiles: 120,
            days: 6,
            isValid: true,
            errors: [],
            generatedRides: Array.from({ length: 6 }, (_, index) => ({ rideIndex: index + 1, date: `2024-02-${String(index + 2).padStart(2, "0")}`, miles: 20, isDuplicate: false, duplicateMatches: [] }))
          },
          {
            rowNumber: 3,
            rawMonth: "January",
            year: 2024,
            totalMiles: 80,
            days: 4,
            isValid: false,
            errors: [{ rowNumber: 3, code: "duplicate-month", message: "Duplicate month found: January", field: "month" }],
            generatedRides: []
          }
        ]
      }
    });
  });

  await recorder.step("Paste duplicate month dataset and preview", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("Month,Miles,Days\nJanuary,100,5\nFebruary,120,6\nJanuary,80,4");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify both January rows are rejected", async () => {
    await expect(page.getByText("Duplicate month found: January")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_intrafile_duplicate_months_rejected");
  await recorder.save(testInfo);
});
