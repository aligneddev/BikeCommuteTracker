import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseHistoryPage,
} from "../../helpers/mock-api.js";

test("Expense list is sorted by newest date first", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_list_sorted_newest_first",
    testTitle: testInfo.title,
  });

  const expenses = [
    {
      expenseId: 11,
      expenseDate: "2024-05-15T00:00:00.000Z",
      amount: 30,
      notes: "Most recent",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-05-15T09:00:00.000Z",
    },
    {
      expenseId: 12,
      expenseDate: "2024-05-01T00:00:00.000Z",
      amount: 20,
      notes: "Middle",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-05-01T09:00:00.000Z",
    },
    {
      expenseId: 13,
      expenseDate: "2024-04-20T00:00:00.000Z",
      amount: 10,
      notes: "Oldest",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-04-20T09:00:00.000Z",
    },
  ];

  await recorder.step("Arrange authenticated session with descending expenses", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses,
      totalAmount: 60,
    });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Assert rows are rendered in newest-first order", async () => {
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("2024-05-15");
    await expect(rows.nth(1)).toContainText("2024-05-01");
    await expect(rows.nth(2)).toContainText("2024-04-20");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_list_sorted_newest_first");
  await recorder.save(testInfo);
});
