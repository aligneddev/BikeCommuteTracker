import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Empty file or header-only file is rejected with clear message", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_with_no_data_rows_rejected", "Empty file or header-only file is rejected with clear message");

  await recorder.step("Seed authenticated session and no-data error response", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page, {
      previewError: {
        status: 400,
        body: {
          message: "No valid data rows detected. Please enter at least one valid month-miles-days entry."
        }
      }
    });
  });

  await recorder.step("Paste header-only input and preview", async () => {
    await page.goto("/import/monthly");
    await page.locator("#monthly-import-textarea").fill("Month,Miles,Days");
    await page.locator('input[type="number"]').fill("2024");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("Verify clear no-data message and no preview", async () => {
    await expect(page.getByRole("alert")).toContainText("No valid data rows detected. Please enter at least one valid month-miles-days entry.");
    await expect(page.getByRole("button", { name: "Start import" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_with_no_data_rows_rejected");
  await recorder.save(testInfo);
});
