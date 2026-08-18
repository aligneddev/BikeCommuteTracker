import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseHistoryPage,
} from "../../helpers/mock-api.js";

test("Expense list displays correct date, amount, note, and receipt actions", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_list_correctly_rendered",
    testTitle: testInfo.title,
  });

  const expenses = [
    {
      expenseId: 1,
      expenseDate: "2024-05-10T00:00:00.000Z",
      amount: 24.99,
      notes: "New chain",
      hasReceipt: true,
      version: 1,
      createdAtUtc: "2024-05-10T09:00:00.000Z",
    },
    {
      expenseId: 2,
      expenseDate: "2024-05-05T00:00:00.000Z",
      amount: 15.5,
      notes: "Long note that exceeds the display limit and should be truncated to 100 characters, followed by ellipsis",
      hasReceipt: false,
      version: 1,
      createdAtUtc: "2024-05-05T09:00:00.000Z",
    },
  ];

  await recorder.step("Arrange authenticated session and two expense rows", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses,
      totalAmount: 40.49,
    });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Assert row values and receipt presence behavior from source", async () => {
    await expect(page.locator("tbody tr")).toHaveCount(2);

    const firstRow = page.locator("tbody tr").nth(0);
    await expect(firstRow).toContainText("2024-05-10");
    await expect(firstRow).toContainText("$24.99");
    await expect(firstRow).toContainText("New chain");
    await expect(firstRow.getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(firstRow.getByRole("button", { name: "Download receipt" })).toBeVisible();

    const secondRow = page.locator("tbody tr").nth(1);
    await expect(secondRow).toContainText("2024-05-05");
    await expect(secondRow).toContainText("$15.50");
    await expect(secondRow).toContainText("Long note that exceeds the display limit and should be truncated to 100 characters, followed by ellipsis");
    await expect(secondRow).toContainText("No");
    await expect(secondRow.getByRole("link", { name: "View receipt" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_list_correctly_rendered");
  await recorder.save(testInfo);
});
