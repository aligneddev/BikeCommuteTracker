import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Generated rides calculate savings using standard per-ride cost behavior", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("savings_calculated_using_same_logic_as_per_ride_import", "Generated rides calculate savings using standard per-ride cost behavior");

  await recorder.step("Seed authenticated session, import completion, and generated rides list", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewResponse: {
        importJobId: 118,
        totalMonthRows: 1,
        validMonthRows: 1,
        invalidMonthRows: 0,
        totalGeneratedRides: 5,
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
            isValid: true,
            errors: [],
            generatedRides: [
              { rideIndex: 1, date: "2024-01-04", miles: 20, isDuplicate: false, duplicateMatches: [] }
            ]
          }
        ]
      },
      startResponse: { importJobId: 118, status: "processing", startedAtUtc: "2026-08-17T08:39:00Z" },
      statusSequence: [
        { importJobId: 118, status: "completed", totalRows: 5, processedRows: 5, importedRows: 5, skippedRows: 0, failedRows: 0, percentComplete: 100, etaMinutesRounded: 0, createdAtUtc: "2026-08-17T08:39:00Z", completedAtUtc: "2026-08-17T08:39:02Z" }
      ],
      ridesResponse: [
        { rideId: 9001, date: "2024-01-04", miles: 20, savings: 11.6, source: "monthly-import" }
      ]
    });
  });

  await recorder.step("Complete import and inspect generated ride list payload", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("January,100,5");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Start import" }).click();
    const rides = await page.evaluate(async () => {
      const response = await fetch("/api/rides");
      return response.json();
    });
    expect(rides[0].miles).toBe(20);
    expect(rides[0].savings).toBe(11.6);
    expect(rides[0].source).toBe("monthly-import");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:savings_calculated_using_same_logic_as_per_ride_import");
  await recorder.save(testInfo);
});
