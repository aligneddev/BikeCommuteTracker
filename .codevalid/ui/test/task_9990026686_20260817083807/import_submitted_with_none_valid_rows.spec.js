import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_submitted_with_none_valid_rows", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_submitted_with_none_valid_rows",
    testTitle: "All-invalid CSV shows global no-valid-rows error and imports nothing",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(400, {
      message: "0 rides imported. All rows failed validation.",
    }));
  });

  await recorder.step("Navigate to Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a CSV where all rows are invalid.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "rides-all-invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles,Difficulty,PrimaryTravelDirection,Notes",
      `2024-05-01T08:00:00,10,6,XYZ,${"A".repeat(600)}`,
      `2024-05-02T08:00:00,11,6,XYZ,${"A".repeat(600)}`,
      `2024-05-03T08:00:00,12,6,XYZ,${"A".repeat(600)}`,
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and verify the global all-rows-failed message is shown.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("0 rides imported. All rows failed validation.")).toBeVisible();
  await expect(page.getByText("Start an import to see progress and cancellation controls.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_submitted_with_none_valid_rows");
  await recorder.save(testInfo);
});
