import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_invalid_date_format", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_date_format",
    testTitle: "Expense fails validation with malformed date",
  });

  await recorder.step("seed authenticated rider", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page);
  });

  await recorder.step("attempt to type malformed date into date input", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("06/15/2024");
    await page.locator('[name="amount"]').fill("35.00");
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert date input remains unsaved and page stays on form", async () => {
    await expect(page).toHaveURL(/\/expenses\/entry$/);
    await expect(page.locator('[name="expenseDate"]')).not.toHaveValue("2024-06-15");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_date_format");
  await recorder.save(testInfo);
});
