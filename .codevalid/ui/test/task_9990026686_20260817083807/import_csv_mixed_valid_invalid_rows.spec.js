import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_mixed_valid_invalid_rows", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_mixed_valid_invalid_rows",
    testTitle: "Mixed valid and invalid rows show per-row validation without halting preview",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 109,
      totalRows: 4,
      validRows: 2,
      invalidRows: 2,
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
          isValid: true,
          errors: [],
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
          isValid: false,
          errors: [
            {
              rowNumber: 2,
              code: "difficulty_range",
              field: "Difficulty",
              message: "Difficulty must be 1–5",
            },
          ],
          duplicateMatches: [],
        },
        {
          rowNumber: 3,
          date: "2024-05-03T08:00:00",
          miles: 12,
          rideMinutes: null,
          temperature: null,
          tags: null,
          notes: null,
          isValid: false,
          errors: [
            {
              rowNumber: 3,
              code: "direction_invalid",
              field: "PrimaryTravelDirection",
              message: "Invalid direction...",
            },
          ],
          duplicateMatches: [],
        },
        {
          rowNumber: 4,
          date: "2024-05-04T08:00:00",
          miles: 13,
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

  await recorder.step("Open the import page.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV containing two valid rows and two invalid rows.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-mixed-valid-invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Difficulty,PrimaryTravelDirection",
      "2024-05-01T08:00:00,10,3,N",
      "2024-05-02T08:00:00,11,0,N",
      "2024-05-03T08:00:00,12,3,XYZ",
      "2024-05-04T08:00:00,13,4,SW",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and verify both row-specific validation failures are displayed while valid rows remain accepted.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 4 | Valid rows: 2 | Invalid rows: 2")).toBeVisible();
  await expect(page.getByText("Row 1: Valid")).toBeVisible();
  await expect(page.getByText("Row 2: Invalid")).toBeVisible();
  await expect(page.getByText("Difficulty: Difficulty must be 1–5")).toBeVisible();
  await expect(page.getByText("Row 3: Invalid")).toBeVisible();
  await expect(page.getByText("PrimaryTravelDirection: Invalid direction...")).toBeVisible();
  await expect(page.getByText("Row 4: Valid")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_mixed_valid_invalid_rows");
  await recorder.save(testInfo);
});
