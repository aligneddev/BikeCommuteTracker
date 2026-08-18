import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Confirm Import button is enabled only after year is selected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("year_selection_enables_confirm_button", "Confirm Import button is enabled only after year is selected");

  await recorder.step("Seed authenticated session and successful preview scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 106,
        totalMonthRows: 2,
        validMonthRows: 2,
        invalidMonthRows: 0,
        totalGeneratedRides: 11,
        duplicateRides: 0,
        requiresDuplicateResolution: false,
        headerDetectionWarning: false,
        monthRows: [
          { rowNumber: 1, rawMonth: "January", year: 2024, totalMiles: 100, days: 5, isValid: true, errors: [], generatedRides: [] },
          { rowNumber: 2, rawMonth: "February", year: 2024, totalMiles: 120, days: 6, isValid: true, errors: [], generatedRides: [] }
        ]
      }
    });
  });

  await recorder.step("Verify preview cannot proceed without year", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5\nFebruary,120,6");
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("alert")).toContainText("Enter a year between 2000 and 2100.");
    await expect(page.getByRole("button", { name: "Start import" })).toHaveCount(0);
  });

  await recorder.step("Select year and verify preview/start becomes available", async () => {
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("button", { name: "Start import" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:year_selection_enables_confirm_button");
  await recorder.save(testInfo);
});
