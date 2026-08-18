import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseReceiptRemovalScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_remove_receipt_on_edit", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_remove_receipt_on_edit",
    testTitle: "Receipt can be removed during expense edit",
  });

  await recorder.step("seed authenticated rider with expense that has a receipt", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseReceiptRemovalScenario(page, {
      expenses: [
        {
          expenseId: 101,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 24.5,
          notes: "Oil change",
          hasReceipt: true,
          version: 1,
          createdAtUtc: "2024-06-15T12:00:00.000Z",
        },
      ],
    });
  });

  await recorder.step("open receipt removal scenario page", async () => {
    await page.goto("/expenses/history?mode=remove-receipt-test");
  });

  await recorder.step("remove receipt and save", async () => {
    await page.getByRole("button", { name: "Edit expense" }).click();
    await page.getByRole("button", { name: "Remove receipt" }).click();
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("assert receipt removed while expense remains", async () => {
    await expect(page.getByText("Expense updated")).toBeVisible();
    await expect(page.getByText("$24.50")).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_remove_receipt_on_edit");
  await recorder.save(testInfo);
});
