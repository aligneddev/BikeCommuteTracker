import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import rejects rows with unrecognized PrimaryTravelDirection/Direction values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_rejects_invalid_primary_travel_direction",
    testTitle: "Import rejects rows with unrecognized PrimaryTravelDirection/Direction values",
  });

  await recorder.step("Arrange invalid direction scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "invalid_direction",
    });
  });

  await recorder.step("Upload CSV with valid and invalid directions", async () => {
    await page.goto("/rides/import");
    await page.locator("#csv-upload-input").setInputFiles({
      name: "invalid-direction.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,PrimaryTravelDirection\n2026-08-01,10,Foo\n2026-08-02,10,XX\n2026-08-03,10,N\n2026-08-04,10,North\n2026-08-05,10,SE\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("Verify direction error text lists accepted values", async () => {
    const errorText = "PrimaryTravelDirection/Direction: Invalid PrimaryTravelDirection/Direction value: must be one of N, NE, E, SE, S, SW, W, NW or North, Northeast, East, Southeast, South, Southwest, West, Northwest.";
    await expect(page.getByText("Total rows: 5 | Valid rows: 3 | Invalid rows: 2")).toBeVisible();
    await expect(page.getByText(errorText)).toHaveCount(2);
  });

  await recorder.step("Start import and verify valid rows still proceed", async () => {
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
    await expect(page.getByText("Imported: 3")).toBeVisible();
    await expect(page.getByText("Failed: 2")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rejects_invalid_primary_travel_direction");
  await recorder.save(testInfo);
});
