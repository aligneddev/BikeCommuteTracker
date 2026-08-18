import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Row with Days exceeding available weekdays is rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_days_greater_than_weekdays_rejected", "Row with Days exceeding available weekdays is rejected");

  await recorder.step("Seed authenticated session and excessive-days preview response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 103,
        totalMonthRows: 1,
        validMonthRows: 0,
        invalidMonthRows: 1,
        totalGeneratedRides: 0,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "February",
            year: 2024,
            totalMiles: 100,
            days: 23,
            isValid: false,
            errors: [{ rowNumber: 1, code: "days-exceed-weekdays", message: "Days (23) exceeds maximum weekdays (20) in February 2024", field: "days" }],
            generatedRides: []
          }
        ]
      }
    });
  });

  await recorder.step("Paste dataset and preview", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("Month,Miles,Days\nFebruary,100,23");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify excessive weekday validation is shown", async () => {
    await expect(page.getByText("Days (23) exceeds maximum weekdays (20) in February 2024")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_days_greater_than_weekdays_rejected");
  await recorder.save(testInfo);
});
