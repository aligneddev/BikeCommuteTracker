import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockExpenseHistoryPage,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";
import {
  juneExpenseOne,
  juneExpenseTwo,
  juneExpenseThree,
} from "../../mock/mock-data.js";

test("Expense history filters list by date range and updates totals", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_history_filter_by_date_range",
    testTitle: testInfo.title,
  });

  await recorder.step("seed expense history with full and filtered responses", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseHistoryPage(page, {
      expenses: [juneExpenseThree, juneExpenseTwo, juneExpenseOne],
      totalAmount: 60,
      filteredByRange: {
        "2024-06-10|2024-06-18": {
          expenses: [juneExpenseTwo],
          totalAmount: 20,
        },
      },
    });
  });

  await recorder.step("open expense history", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("apply date range filter", async () => {
    await page.locator("#expense-filter-from").fill("2024-06-10");
    await page.locator("#expense-filter-to").fill("2024-06-18");
    await page.getByRole("button", { name: "Apply Filter" }).click();
  });

  await recorder.step("assert only filtered row and filtered total", async () => {
    await expect(page.getByText("Filtered total: $20.00")).toBeVisible();
    await expect(page.getByText("2024-06-15")).toBeVisible();
    await expect(page.getByText("$20.00")).toBeVisible();
    await expect(page.getByText("2024-06-01")).toHaveCount(0);
    await expect(page.getByText("2024-06-20")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_history_filter_by_date_range");
  await recorder.save(testInfo);
});
