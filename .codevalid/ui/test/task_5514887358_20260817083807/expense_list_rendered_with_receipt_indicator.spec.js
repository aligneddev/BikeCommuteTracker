import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockExpenseHistoryPage,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";
import {
  expenseWithReceipt,
  expenseWithoutReceipt,
} from "../../mock/mock-data.js";

test("Expense history lists expenses with receipt indicator", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_list_rendered_with_receipt_indicator",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and two expense rows", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses: [expenseWithReceipt, expenseWithoutReceipt],
      totalAmount: 34.5,
      filteredByRange: {},
    });
  });

  await recorder.step("open expense history", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("assert expense rows and receipt actions", async () => {
    await expect(page.getByText("2024-06-15")).toBeVisible();
    await expect(page.getByText("$24.50")).toBeVisible();
    await expect(page.getByText("Oil change...".replace("...", ""))).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download receipt" })).toBeVisible();
    await expect(page.getByText("2024-06-14")).toBeVisible();
    await expect(page.getByText("$10.00")).toBeVisible();
    await expect(page.getByText("No", { exact: true })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_list_rendered_with_receipt_indicator");
  await recorder.save(testInfo);
});
