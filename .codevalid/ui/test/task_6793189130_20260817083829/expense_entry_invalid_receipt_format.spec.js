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
const invalidReceiptPath = path.resolve(__dirname, "../../mock/fixtures/receipt-invalid.txt");

test("expense_entry_invalid_receipt_format", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_receipt_format",
    testTitle: "Expense rejects invalid receipt file format (e.g., TXT)",
  });

  await recorder.step("seed authenticated rider and save-without-receipt scenario", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: false },
      historyAfterSave: [
        {
          expenseId: 504,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 20,
          notes: undefined,
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("fill form and upload invalid receipt type", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("20.00");
    await page.locator('[name="receipt"]').setInputFiles(invalidReceiptPath);
  });

  await recorder.step("assert non-blocking client validation and save", async () => {
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toBeVisible();
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await page.goto("/expenses/history");
    await expect(page.getByText("$20.00")).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_receipt_format");
  await recorder.save(testInfo);
});
