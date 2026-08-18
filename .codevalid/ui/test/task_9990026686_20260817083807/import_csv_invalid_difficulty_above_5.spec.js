import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_invalid_difficulty_above_5", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_invalid_difficulty_above_5",
    testTitle: "CSV with Difficulty above 5 is rejected per row",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 104,
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2024-05-01T08:00:00",
          miles: 8,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: null,
          isValid: false,
          errors: [
            {
              rowNumber: 1,
              code: "difficulty_range",
              field: "Difficulty",
              message: "Difficulty must be an integer between 1 and 5",
            },
          ],
          duplicateMatches: [],
        },
        {
          rowNumber: 2,
          date: "2024-05-02T08:00:00",
          miles: 11,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: null,
          isValid: true,
          errors: [],
          duplicateMatches: [],
        },
      ],
    }));
  });

  await recorder.step("Open Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV where row 1 has Difficulty=6 and row 2 is valid.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-invalid-difficulty-above-5.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Difficulty",
      "2024-05-01T08:00:00,8,6",
      "2024-05-02T08:00:00,11,2",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and verify the difficulty range error is shown for row 1 only.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 1 | Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Invalid")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be an integer between 1 and 5")).toBeVisible();
  await expect(page.getByText("Row 2: Valid")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_invalid_difficulty_above_5");
  await recorder.save(testInfo);
});
