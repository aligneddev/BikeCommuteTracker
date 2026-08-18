import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Submission is blocked if all fields are empty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_empty_fields_reject",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and submit empty form", async () => {
    await page.goto("/expenses/entry");
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert required field validations", async () => {
    await expect(page.getByText("Expense date is required")).toBeVisible();
    await expect(page.getByText("Amount must be greater than zero")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("");
    await expect(page.locator('[name="amount"]')).toHaveValue("");
    await expect(page.locator('[name="note"]')).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_empty_fields_reject");
  await recorder.save(testInfo);
});
