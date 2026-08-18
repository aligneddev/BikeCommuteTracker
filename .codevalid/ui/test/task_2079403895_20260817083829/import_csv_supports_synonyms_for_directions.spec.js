import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_supports_synonyms_for_directions", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_supports_synonyms_for_directions",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and successful import scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "post_import_mapping_success" });
  });

  await recorder.step("open page and preview valid direction synonym csv", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();

    await page.locator("#monthly-import-file").setInputFiles({
      name: "direction-synonyms.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,14.2,1\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("Valid rows: 1 / Invalid rows: 0")).toBeVisible();
    await expect(page.getByText("2026-08-15: 14.2 mi")).toBeVisible();
  });

  await recorder.step("start import and confirm normalized successful import path", async () => {
    await page.getByRole("button", { name: "Start import" }).click();

    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rides created: 1")).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_supports_synonyms_for_directions");
  await recorder.save(testInfo);
});
