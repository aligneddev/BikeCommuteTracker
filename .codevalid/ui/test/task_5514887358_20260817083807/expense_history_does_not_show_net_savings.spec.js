import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseHistoryPage,
} from "../../helpers/mock-api.js";

test("ExpenseHistoryPage does not display net savings or oil-change values", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_history_does_not_show_net_savings",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and expense history", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses: [
        {
          expenseId: 601,
          expenseDate: "2024-06-01T00:00:00.000Z",
          amount: 15,
          notes: "Brake pads",
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2024-06-01T09:00:00.000Z",
        },
      ],
      totalAmount: 15,
    });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Assert history UI only and no dashboard savings text", async () => {
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Import Expenses" })).toBeVisible();
    await expect(page.getByText(/Net Expense/i)).toHaveCount(0);
    await expect(page.getByText(/Oil-?change savings/i)).toHaveCount(0);
    await expect(page.getByText(/Net Savings/i)).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_history_does_not_show_net_savings");
  await recorder.save(testInfo);
});
