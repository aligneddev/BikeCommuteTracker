import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import rejects rows with Difficulty outside range 1–5", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_rejects_invalid_difficulty",
    testTitle: "Import rejects rows with Difficulty outside range 1–5",
  });

  await recorder.step("Arrange invalid difficulty preview and import scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "invalid_difficulty",
    });
  });

  await recorder.step("Navigate and upload mixed difficulty CSV", async () => {
    await page.goto("/rides/import");
    await page.locator("#csv-upload-input").setInputFiles({
      name: "invalid-difficulty.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,Difficulty\n2026-08-01,10,0\n2026-08-02,10,6\n2026-08-03,10,1\n2026-08-04,10,2\n2026-08-05,10,3\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("Verify row-level difficulty validation messages", async () => {
    await expect(page.getByText("Total rows: 5 | Valid rows: 3 | Invalid rows: 2")).toBeVisible();
    await expect(page.getByText("Difficulty: Invalid Difficulty value: must be between 1 and 5.")).toHaveCount(2);
  });

  await recorder.step("Start import and verify partial success counts", async () => {
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
    await expect(page.getByText("Imported: 3")).toBeVisible();
    await expect(page.getByText("Failed: 2")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rejects_invalid_difficulty");
  await recorder.save(testInfo);
});
