import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import handles files with mixed valid and invalid rows without blocking entire batch", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_handles_mixed_valid_and_invalid_rows",
    testTitle: "Import handles files with mixed valid and invalid rows without blocking entire batch",
  });

  await recorder.step("Arrange mixed valid and invalid import scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "mixed_valid_invalid",
    });
  });

  await recorder.step("Upload mixed CSV and preview", async () => {
    await page.goto("/rides/import");
    await page.locator("#csv-upload-input").setInputFiles({
      name: "mixed-valid-invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,Difficulty,PrimaryTravelDirection,Notes\n2026-08-01,10,0,N,ok\n2026-08-02,10,3,Foo,ok\n2026-08-03,10,3,N,too-long\n2026-08-04,10,3,SE,good\n2026-08-05,10,2,North,good\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("Verify all three error categories are shown", async () => {
    await expect(page.getByText("Total rows: 5 | Valid rows: 2 | Invalid rows: 3")).toBeVisible();
    await expect(page.getByText("Difficulty: Invalid Difficulty value: must be between 1 and 5.")).toBeVisible();
    await expect(page.getByText("PrimaryTravelDirection/Direction: Invalid PrimaryTravelDirection/Direction value: must be one of N, NE, E, SE, S, SW, W, NW or North, Northeast, East, Southeast, South, Southwest, West, Northwest.")).toBeVisible();
    await expect(page.getByText("Notes: Notes exceed maximum length of 500 characters.")).toBeVisible();
  });

  await recorder.step("Start import and verify partial batch outcome", async () => {
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
    await expect(page.getByText("Imported: 2")).toBeVisible();
    await expect(page.getByText("Failed: 3")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_handles_mixed_valid_and_invalid_rows");
  await recorder.save(testInfo);
});
