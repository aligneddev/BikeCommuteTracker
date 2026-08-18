import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

function jsonResponse(status, body) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

test("import_csv_corrupted_format", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_corrupted_format",
    testTitle: "Malformed CSV structure is rejected with clear error",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  await page.route("**/api/imports/preview", async (route) => {
    await route.fulfill(jsonResponse(400, {
      message: "CSV format error: inconsistent number of columns. Please ensure all rows have the same structure.",
    }));
  });

  await recorder.step("Open Import Rides.");
  await page.goto("/rides/import");

  await recorder.step("Upload a malformed CSV with inconsistent column counts.");
  await page.locator("#csv-upload-input").setInputFiles({
    name: "corrupted.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "Date,Miles",
      "2024-05-01T08:00:00,10",
      "2024-05-02T08:00:00,12,NE,Note,Extra",
    ].join("\n"), "utf8"),
  });

  await recorder.step("Preview and confirm the structured CSV format error appears.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText("CSV format error: inconsistent number of columns. Please ensure all rows have the same structure.")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_corrupted_format");
  await recorder.save(testInfo);
});
