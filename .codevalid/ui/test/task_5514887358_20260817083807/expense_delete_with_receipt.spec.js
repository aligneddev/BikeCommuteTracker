import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  setupExpenseDeleteScenario,
} from "../../helpers/mock-api.js";

test("Expense deletion with receipt removes row and stays deleted after refresh", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_delete_with_receipt",
    testTitle: testInfo.title,
  });

  const expense = {
    expenseId: 401,
    expenseDate: "2024-06-15T00:00:00.000Z",
    amount: 24.5,
    notes: "Oil change",
    hasReceipt: true,
    version: 1,
    createdAtUtc: "2024-06-15T12:00:00.000Z",
  };

  await recorder.step("Arrange authenticated session and deletable expense", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseDeleteScenario(page, { expenses: [expense] });
  });

  await recorder.step("Delete expense", async () => {
    await page.goto("/expenses/history");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Delete expense" }).click();
  });

  await recorder.step("Assert expense disappears and remains gone after reload", async () => {
    await expect(page.getByText("Expense deleted")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByText("No expenses found.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_delete_with_receipt");
  await recorder.save(testInfo);
});
