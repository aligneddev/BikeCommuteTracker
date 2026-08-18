import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_valid_input_no_receipt", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_input_no_receipt",
    testTitle: "Valid expense with date and amount, no receipt",
  });

  await recorder.step("seed authenticated rider and mock entry/history apis", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: false },
      historyAfterSave: [
        {
          expenseId: 501,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 25.5,
          notes: undefined,
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("open expense entry page", async () => {
    await page.goto("/expenses/entry");
    await expect(page.getByRole("heading", { name: "Record Expense" })).toBeVisible();
  });

  await recorder.step("fill valid date and amount with empty note", async () => {
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("25.50");
    await page.locator('[name="note"]').fill("");
  });

  await recorder.step("submit expense", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert success and saved expense appears in history", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Amount must be greater than zero")).toHaveCount(0);
    await page.goto("/expenses/history");
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    await expect(page.getByText("$25.50")).toBeVisible();
    await expect(page.getByRole("cell", { name: "No" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_input_no_receipt");
  await recorder.save(testInfo);
});
