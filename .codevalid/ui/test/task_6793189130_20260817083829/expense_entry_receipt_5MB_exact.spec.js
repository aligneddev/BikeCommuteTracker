import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exactSizeReceiptPath = path.resolve(__dirname, "../../mock/fixtures/receipt-exact-5mb.pdf");

test("expense_entry_receipt_5MB_exact", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_receipt_5MB_exact",
    testTitle: "Expense accepts receipt exactly at 5MB limit",
  });

  await recorder.step("seed authenticated rider and receipt-attached scenario", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: true },
      historyAfterSave: [
        {
          expenseId: 506,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 40,
          notes: undefined,
          hasReceipt: true,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("upload exact-limit pdf and submit", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("40.00");
    await page.locator('[name="receipt"]').setInputFiles(exactSizeReceiptPath);
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert successful save with receipt indicator in history", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await page.goto("/expenses/history");
    await expect(page.getByText("$40.00")).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_receipt_5MB_exact");
  await recorder.save(testInfo);
});
