import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_rejects_invalid_difficulty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_rejects_invalid_difficulty",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and invalid difficulty scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "invalid_difficulty" });
  });

  await recorder.step("open page and upload csv", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "invalid-difficulty.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,50,5\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify row-level difficulty validation appears", async () => {
    await expect(page.getByText("Valid rows: 3 / Invalid rows: 2")).toBeVisible();
    await expect(
      page.getByText("Invalid Difficulty value: must be between 1 and 5.")
    ).toBeVisible();
  });

  await recorder.step("start import and verify valid rows still complete", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 3")).toBeVisible();
    await expect(page.getByText("Rows rejected: 2")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_rejects_invalid_difficulty");
  await recorder.save(testInfo);
});
