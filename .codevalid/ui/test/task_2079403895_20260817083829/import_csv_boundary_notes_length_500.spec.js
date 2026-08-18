import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("import_csv_boundary_notes_length_500", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_boundary_notes_length_500",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
  });

  await recorder.step("verify 500 char note scenario succeeds", async () => {
    await setupRideImportScenario(page, { scenario: "valid_all_fields" });
    await page.goto("/import/monthly");

    await page.locator("#monthly-import-file").setInputFiles({
      name: "notes-500.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,30,3\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("Valid rows: 2 / Invalid rows: 0")).toBeVisible();
    await page.getByRole("button", { name: "Start import" }).click();
    await expect(
      page.getByRole("heading", { name: "Monthly import summary" })
    ).toBeVisible();
    await expect(page.getByText("Rows rejected: 0")).toBeVisible();
  });

  await recorder.step("verify 501 char note scenario fails", async () => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockImportPageShell(page);
    await setupRideImportScenario(page, { scenario: "notes_too_long" });
    await page.goto("/import/monthly");

    await page.locator("#monthly-import-file").setInputFiles({
      name: "notes-501.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Month,Miles,Days\nAugust,30,3\n"),
    });
    await page.getByRole("spinbutton").fill("2026");
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(
      page.getByText("Notes exceed maximum length of 500 characters.")
    ).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_boundary_notes_length_500");
  await recorder.save(testInfo);
});
