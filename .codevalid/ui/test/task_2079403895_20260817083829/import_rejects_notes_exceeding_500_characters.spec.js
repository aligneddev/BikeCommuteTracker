import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import rejects rows where Notes exceed 500 characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_rejects_notes_exceeding_500_characters",
    testTitle: "Import rejects rows where Notes exceed 500 characters",
  });

  await recorder.step("Arrange notes length validation scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "notes_too_long",
    });
  });

  await recorder.step("Upload CSV with overlong notes", async () => {
    await page.goto("/rides/import");
    await page.locator("#csv-upload-input").setInputFiles({
      name: "notes-too-long.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`Date,Miles,Notes\n2026-08-01,10,${"a".repeat(501)}\n2026-08-02,10,${"b".repeat(100)}\n`),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("Verify notes error is row-level", async () => {
    await expect(page.getByText("Total rows: 2 | Valid rows: 1 | Invalid rows: 1")).toBeVisible();
    await expect(page.getByText("Notes: Notes exceed maximum length of 500 characters.")).toBeVisible();
  });

  await recorder.step("Start import and verify one success one failure", async () => {
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
    await expect(page.getByText("Imported: 1")).toBeVisible();
    await expect(page.getByText("Failed: 1")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rejects_notes_exceeding_500_characters");
  await recorder.save(testInfo);
});
