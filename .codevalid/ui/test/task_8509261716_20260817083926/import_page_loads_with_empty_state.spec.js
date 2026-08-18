import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupMonthlyImportScenario } from "../../helpers/mock-api.js";

test("Monthly Import page loads with empty input and disabled Confirm button", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_page_loads_with_empty_state", "Monthly Import page loads with empty input and disabled Confirm button");

  await recorder.step("Seed authenticated session and monthly import routes", async () => {
    await setupAuthenticatedSession(page);
    await setupMonthlyImportScenario(page);
  });

  await recorder.step("Load the MonthlyImportPage", async () => {
    await page.goto("/import/monthly");
  });

  await recorder.step("Verify empty state and absence of preview or summary", async () => {
    await expect(page.getByRole("heading", { name: "Monthly Summary Import" })).toBeVisible();
    await expect(page.locator("#monthly-import-textarea")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Preview import" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Start import" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Monthly import summary" })).toHaveCount(0);
    await expect(page.getByText("No month rows found.")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_page_loads_with_empty_state");
  await recorder.save(testInfo);
});
