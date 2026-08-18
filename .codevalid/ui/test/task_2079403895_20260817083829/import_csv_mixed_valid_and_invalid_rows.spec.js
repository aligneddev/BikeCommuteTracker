import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_mixed_valid_and_invalid_rows", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_mixed_valid_and_invalid_rows",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and mixed valid invalid scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "mixed_valid_invalid" });
  });

  await recorder.step("open page and preview mixed csv", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "mixed-valid-invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,50,5\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify each row-level error is surfaced during preview", async () => {
    await expect(page.getByText("Valid rows: 2 / Invalid rows: 3")).toBeVisible();
    await expect(
      page.getByText("Invalid Difficulty value: must be between 1 and 5.")
    ).toBeVisible();
    await expect(
      page.getByText(
        "Invalid PrimaryTravelDirection/Direction value: must be one of N, NE, E, SE, S, SW, W, NW or North, Northeast, East, Southeast, South, Southwest, West, Northwest."
      )
    ).toBeVisible();
    await expect(
      page.getByText("Notes exceed maximum length of 500 characters.")
    ).toBeVisible();
  });

  await recorder.step("start import and confirm only valid rows are created", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 2")).toBeVisible();
    await expect(page.getByText("Rows rejected: 3")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_mixed_valid_and_invalid_rows");
  await recorder.save(testInfo);
});
