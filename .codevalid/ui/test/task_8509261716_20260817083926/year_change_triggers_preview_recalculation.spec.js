import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Changing year after preview updates all generated ride dates", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("year_change_triggers_preview_recalculation", "Changing year after preview updates all generated ride dates");

  await recorder.step("Seed authenticated session with year-sensitive preview routing", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponder: async ({ startYear }) => {
        const boundaryYear = Number(startYear);
        return {
          importJobId: 109,
          totalMonthRows: 3,
          validMonthRows: 3,
          invalidMonthRows: 0,
          totalGeneratedRides: 15,
          duplicateRides: 0,
          requiresDuplicateResolution: false,
          headerDetectionWarning: false,
          monthRows: [
            { rowNumber: 1, rawMonth: "November", year: boundaryYear, totalMiles: 100, days: 4, isValid: true, errors: [], generatedRides: [{ rideIndex: 1, date: `${boundaryYear}-11-08`, miles: 25, isDuplicate: false, duplicateMatches: [] }] },
            { rowNumber: 2, rawMonth: "December", year: boundaryYear, totalMiles: 120, days: 5, isValid: true, errors: [], generatedRides: [{ rideIndex: 2, date: `${boundaryYear}-12-06`, miles: 24, isDuplicate: false, duplicateMatches: [] }] },
            { rowNumber: 3, rawMonth: "January", year: boundaryYear + 1, totalMiles: 130, days: 6, isValid: true, errors: [], generatedRides: [{ rideIndex: 3, date: `${boundaryYear + 1}-01-06`, miles: 21.66, isDuplicate: false, duplicateMatches: [] }] }
          ]
        };
      }
    });
  });

  await recorder.step("Preview with 2024", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("November,100,4\nDecember,120,5\nJanuary,130,6");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("2024-11-08: 25 mi")).toBeVisible();
    await expect(page.getByText("2025-01-06: 21.66 mi")).toBeVisible();
  });

  await recorder.step("Change year to 2025 and re-preview", async () => {
    await page.locator('input[type="number"]').fill("2025");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify recalculated preview uses 2025/2026", async () => {
    await expect(page.getByText("2025-11-08: 25 mi")).toBeVisible();
    await expect(page.getByText("2025-12-06: 24 mi")).toBeVisible();
    await expect(page.getByText("2026-01-06: 21.66 mi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start import" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:year_change_triggers_preview_recalculation");
  await recorder.save(testInfo);
});
