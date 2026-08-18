import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_invalid_difficulty_below_1", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_invalid_difficulty_below_1",
    testTitle: "CSV with Difficulty below 1 is rejected per row",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 103,
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 0,
      requiresDuplicateResolution: false,
      rows: [
        {
          rowNumber: 1,
          date: "2024-05-01T08:00:00",
          miles: 10,
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
          miles: 12,
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

  await recorder.step("Navigate to Import Rides.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Upload a CSV where row 1 has Difficulty=0 and row 2 has a valid Difficulty.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-invalid-difficulty-below-1.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Difficulty",
      "2024-05-01T08:00:00,10,0",
      "2024-05-02T08:00:00,12,4",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview the import and confirm the row-level validation message is shown.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 1 | Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Invalid")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be an integer between 1 and 5")).toBeVisible();
  await expect(page.getByText("Row 2: Valid")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_invalid_difficulty_below_1");
  await recorder.save(testInfo);
});
