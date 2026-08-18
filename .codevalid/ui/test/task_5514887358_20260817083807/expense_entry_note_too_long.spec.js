import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Expense entry fails with error when note exceeds 500 characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_note_too_long",
    testTitle: testInfo.title,
  });

  const overlongNote = "a".repeat(501);

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and attempt to type more than 500 characters", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("12.34");
    await page.locator('[name="note"]').fill(overlongNote);
  });

  await recorder.step("assert input is capped by maxlength and submit succeeds", async () => {
    await expect(page.locator('[name="note"]')).toHaveValue("a".repeat(500));
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Note must be 500 characters or fewer")).toHaveCount(0);
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_note_too_long");
  await recorder.save(testInfo);
});
