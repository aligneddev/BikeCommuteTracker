import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_rejects_notes_exceeding_500_chars", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_rejects_notes_exceeding_500_chars",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and notes length validation scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "notes_too_long" });
  });

  await recorder.step("open page and preview file", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "notes-too-long.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,20,2\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify note length validation message", async () => {
    await expect(page.getByText("Valid rows: 1 / Invalid rows: 1")).toBeVisible();
    await expect(
      page.getByText("Notes exceed maximum length of 500 characters.")
    ).toBeVisible();
  });

  await recorder.step("start import and verify one row succeeds and one fails", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 1")).toBeVisible();
    await expect(page.getByText("Rows rejected: 1")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_rejects_notes_exceeding_500_chars");
  await recorder.save(testInfo);
});
