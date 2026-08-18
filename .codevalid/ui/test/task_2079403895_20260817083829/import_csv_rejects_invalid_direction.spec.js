import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_rejects_invalid_direction", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_rejects_invalid_direction",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and invalid direction scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "invalid_direction" });
  });

  await recorder.step("open page and preview uploaded csv", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "invalid-direction.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,40,4\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
  });

  await recorder.step("verify direction error message lists accepted values", async () => {
    await expect(page.getByText("Valid rows: 3 / Invalid rows: 2")).toBeVisible();
    await expect(
      page.getByText(
        "Invalid PrimaryTravelDirection/Direction value: must be one of N, NE, E, SE, S, SW, W, NW or North, Northeast, East, Southeast, South, Southwest, West, Northwest."
      )
    ).toBeVisible();
  });

  await recorder.step("start import and confirm mixed outcome summary", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 3")).toBeVisible();
    await expect(page.getByText("Rows rejected: 2")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_rejects_invalid_direction");
  await recorder.save(testInfo);
});
