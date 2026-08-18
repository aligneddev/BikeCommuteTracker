import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseHistoryPage,
} from "../../helpers/mock-api.js";

test("Empty state is displayed when no expenses exist", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_history_empty_state",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and empty expense history", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses: [],
      totalAmount: 0,
    });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Assert empty state and no expense rows", async () => {
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    await expect(page.getByText("No expenses found.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Expense history table" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_history_empty_state");
  await recorder.save(testInfo);
});
