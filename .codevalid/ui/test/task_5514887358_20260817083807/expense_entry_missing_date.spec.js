import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Expense entry fails with error when date is missing", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_missing_date",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and fill non-date fields", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="amount"]').fill("25.00");
    await page.locator('[name="note"]').fill("Bike light battery");
  });

  await recorder.step("submit without date", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert validation and preserved values", async () => {
    await expect(page.getByText("Expense date is required")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("");
    await expect(page.locator('[name="amount"]')).toHaveValue("25.00");
    await expect(page.locator('[name="note"]')).toHaveValue("Bike light battery");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_missing_date");
  await recorder.save(testInfo);
});
