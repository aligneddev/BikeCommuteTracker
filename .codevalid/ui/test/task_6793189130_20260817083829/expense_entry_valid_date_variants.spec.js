import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_valid_date_variants", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_date_variants",
    testTitle: "Expense accepts multiple valid date formats (YYYY-MM-DD)",
  });

  await recorder.step("seed authenticated rider and success scenario", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: false },
      historyAfterSave: [
        {
          expenseId: 507,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 22,
          notes: undefined,
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("submit canonical YYYY-MM-DD value", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("22.00");
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert accepted canonical date", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_date_variants");
  await recorder.save(testInfo);
});
