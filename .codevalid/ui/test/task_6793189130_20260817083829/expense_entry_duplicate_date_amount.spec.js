import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_duplicate_date_amount", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_duplicate_date_amount",
    testTitle: "Duplicate date+amount entries allowed (not restricted)",
  });

  await recorder.step("seed authenticated rider with existing matching expense", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      initialHistory: [
        {
          expenseId: 601,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 25,
          notes: "Original",
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2024-06-15T08:00:00.000Z",
        },
      ],
      postResponse: { receiptAttached: false },
      historyAfterSave: [
        {
          expenseId: 601,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 25,
          notes: "Original",
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2024-06-15T08:00:00.000Z",
        },
        {
          expenseId: 602,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 25,
          notes: undefined,
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("record a duplicate manual expense", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("25.00");
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  await recorder.step("verify both matching entries are present in history", async () => {
    await page.goto("/expenses/history");
    await expect(page.getByText("$25.00")).toHaveCount(2);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_duplicate_date_amount");
  await recorder.save(testInfo);
});
