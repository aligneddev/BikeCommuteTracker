import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_notes_over_500_characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_notes_over_500_characters",
    testTitle: "CSV notes over 500 characters are rejected per row",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const longNote = "A".repeat(501);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 107,
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
          notes: longNote,
          isValid: false,
          errors: [
            {
              rowNumber: 1,
              code: "notes_length",
              field: "Notes",
              message: "Notes must be 500 characters or fewer",
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
          notes: "Good ride.",
          isValid: true,
          errors: [],
          duplicateMatches: [],
        },
      ],
    }));
  });

  await recorder.step("Navigate to Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV where one row contains Notes longer than 500 characters.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-notes-too-long.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Notes",
      `2024-05-01T08:00:00,10,${longNote}`,
      '2024-05-02T08:00:00,12,"Good ride."',
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and verify the row-level notes length error appears.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 1 | Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Invalid")).toBeVisible();
  await expect(page.getByText("Notes: Notes must be 500 characters or fewer")).toBeVisible();
  await expect(page.getByText("Row 2: Valid")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_notes_over_500_characters");
  await recorder.save(testInfo);
});
