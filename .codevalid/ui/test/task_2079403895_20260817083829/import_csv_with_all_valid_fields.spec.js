import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_with_all_valid_fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_with_all_valid_fields",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and valid monthly import scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "valid_all_fields" });
  });

  await recorder.step("open monthly import page", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();
  });

  await recorder.step("upload csv and preview import", async () => {
    await page.locator("#monthly-import-file").setInputFiles({
      name: "valid-all-fields.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,20,2\nSeptember,18,2\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("Valid rows: 2 / Invalid rows: 0")).toBeVisible();
    await expect(page.getByText("Total generated rides: 2")).toBeVisible();
    await expect(page.getByText("Duplicate rides: 0")).toBeVisible();
  });

  await recorder.step("start import and verify completion summary", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 2")).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
    await expect(page.getByText("Rides skipped: 0")).toBeVisible();
    await expect(page.getByText("Morning ride")).toBeHidden({ timeout: 100 });
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_with_all_valid_fields");
  await recorder.save(testInfo);
});
