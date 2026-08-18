import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Expense entry fails with error when amount is zero or negative", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_amount",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and enter invalid zero amount", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("0");
    await page.locator('[name="note"]').fill("Patch kit");
  });

  await recorder.step("submit form", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert amount validation", async () => {
    await expect(page.getByText("Amount must be greater than zero")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("0");
    await expect(page.locator('[name="note"]')).toHaveValue("Patch kit");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_amount");
  await recorder.save(testInfo);
});
