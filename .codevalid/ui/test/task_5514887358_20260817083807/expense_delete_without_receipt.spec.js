import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  setupExpenseDeleteScenario,
} from "../../helpers/mock-api.js";

test("Expense deletion without receipt removes row and updates UI", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_delete_without_receipt",
    testTitle: testInfo.title,
  });

  const expense = {
    expenseId: 402,
    expenseDate: "2024-06-14T00:00:00.000Z",
    amount: 10,
    notes: "Tube",
    hasReceipt: false,
    version: 1,
    createdAtUtc: "2024-06-14T12:00:00.000Z",
  };

  await recorder.step("Arrange authenticated session and one expense without receipt", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseDeleteScenario(page, { expenses: [expense] });
  });

  await recorder.step("Delete expense from history", async () => {
    await page.goto("/expenses/history");
    await page.getByRole("button", { name: "Delete expense" }).click();
  });

  await recorder.step("Assert row removed and empty state shown", async () => {
    await expect(page.getByText("Expense deleted")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByText("No expenses found.")).toBeVisible();
    await expect(page.getByText("Total: $0.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_delete_without_receipt");
  await recorder.save(testInfo);
});
