import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_invalid_compass_direction", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_invalid_compass_direction",
    testTitle: "CSV with invalid direction is rejected with accepted values listed",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const directionMessage = "Invalid direction. Accepted values: N, NE, E, SE, S, SW, W, NW or full names: North, Northeast, etc.";

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(200, {
      importJobId: 105,
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
              code: "direction_invalid",
              field: "PrimaryTravelDirection",
              message: directionMessage,
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

  await recorder.step("Navigate to the import page.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Upload a CSV containing one invalid compass direction and one valid row.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-invalid-direction.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,PrimaryTravelDirection",
      "2024-05-01T08:00:00,10,XYZ",
      "2024-05-02T08:00:00,12,NE",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and verify the row-specific direction validation message.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("Total rows: 2 | Valid rows: 1 | Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Invalid")).toBeVisible();
  await expect(page.getByText(`PrimaryTravelDirection: ${directionMessage}`)).toBeVisible();
  await expect(page.getByText("Row 2: Valid")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_invalid_compass_direction");
  await recorder.save(testInfo);
});
