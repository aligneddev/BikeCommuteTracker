import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Miles per day correctly distribute with rounding remainder applied to last ride", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("mile_distribution_with_rounding_remainder_applied", "Miles per day correctly distribute with rounding remainder applied to last ride");

  await recorder.step("Seed authenticated session and rounding preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 111,
        totalMonthRows: 1,
        validMonthRows: 1,
        invalidMonthRows: 0,
        totalGeneratedRides: 3,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "January",
            year: 2024,
            totalMiles: 100,
            days: 3,
            isValid: true,
            errors: [],
            generatedRides: [
              { rideIndex: 1, date: "2024-01-08", miles: 33.33, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 2, date: "2024-01-16", miles: 33.33, isDuplicate: false, duplicateMatches: [] },
              { rideIndex: 3, date: "2024-01-24", miles: 33.34, isDuplicate: false, duplicateMatches: [] }
            ]
          }
        ]
      }
    });
  });

  await recorder.step("Preview rounding dataset", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,3");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify 33.33, 33.33, and 33.34 distribution", async () => {
    await expect(page.getByText("2024-01-08: 33.33 mi")).toBeVisible();
    await expect(page.getByText("2024-01-16: 33.33 mi")).toBeVisible();
    await expect(page.getByText("2024-01-24: 33.34 mi")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:mile_distribution_with_rounding_remainder_applied");
  await recorder.save(testInfo);
});
