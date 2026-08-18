import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseHistoryPage,
} from "../../helpers/mock-api.js";

test("Expense list filters correctly by date range", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_filter_by_date_range",
    testTitle: testInfo.title,
  });

  const allExpenses = [
    {
      expenseId: 21,
      expenseDate: "2024-06-01T00:00:00.000Z",
      amount: 15,
      notes: "June expense",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-06-01T09:00:00.000Z",
    },
    {
      expenseId: 22,
      expenseDate: "2024-05-15T00:00:00.000Z",
      amount: 20,
      notes: "May expense",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-05-15T09:00:00.000Z",
    },
    {
      expenseId: 23,
      expenseDate: "2024-04-10T00:00:00.000Z",
      amount: 10,
      notes: "April expense",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-04-10T09:00:00.000Z",
    },
  ];

  await recorder.step("Arrange authenticated session and filtered API response", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses: allExpenses,
      totalAmount: 45,
      filteredByRange: {
        "2024-05-01|2024-06-10": {
          expenses: [allExpenses[0], allExpenses[1]],
          totalAmount: 35,
        },
      },
    });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Apply date filter", async () => {
    await page.locator("#expense-filter-from").fill("2024-05-01");
    await page.locator("#expense-filter-to").fill("2024-06-10");
    await page.getByRole("button", { name: "Apply Filter" }).click();
  });

  await recorder.step("Assert filtered rows and total", async () => {
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(page.getByText("Filtered total: $35.00")).toBeVisible();
    await expect(page.getByText("2024-05-15")).toBeVisible();
    await expect(page.getByText("2024-06-01")).toBeVisible();
    await expect(page.getByText("2024-04-10")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_filter_by_date_range");
  await recorder.save(testInfo);
});
