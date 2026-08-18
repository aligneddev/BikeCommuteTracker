import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Input with no headers triggers positional column detection and user confirmation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_no_headers_positional_detection", "Input with no headers triggers positional column detection and user confirmation");

  await recorder.step("Seed authenticated session and header-detection warning preview", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 105,
        totalMonthRows: 2,
        validMonthRows: 2,
        invalidMonthRows: 0,
        totalGeneratedRides: 11,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: true,
        monthRows: [
          {
            rowNumber: 1,
            rawMonth: "January",
            year: 2024,
            totalMiles: 100,
            days: 5,
            isValid: true,
            errors: [],
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
            generatedRides: []
          }
        ]
      }
    });
  });

  await recorder.step("Paste headerless input and preview", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5\nFebruary,120,6");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify warning and mapping confirmation are required", async () => {
    await expect(page.getByRole("alert").filter({ hasText: "Column mapping was detected automatically" })).toBeVisible();
    await expect(page.getByText("Please confirm the columns are correct before importing.")).toBeVisible();
    await expect(page.getByText("Confirm column mapping")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_no_headers_positional_detection");
  await recorder.save(testInfo);
});
