import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Note length is constrained by maxlength in real time", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_large_note_validated_on_fly",
    testTitle: testInfo.title,
  });

  const longNote = "a".repeat(600);

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and type beyond the note limit", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="note"]').fill(longNote);
  });

  await recorder.step("assert note is capped at 500 characters", async () => {
    await expect(page.locator('[name="note"]')).toHaveValue("a".repeat(500));
  });

  await recorder.step("submit valid form with capped note", async () => {
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("11.11");
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Note must be 500 characters or fewer")).toHaveCount(0);
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_large_note_validated_on_fly");
  await recorder.save(testInfo);
});
