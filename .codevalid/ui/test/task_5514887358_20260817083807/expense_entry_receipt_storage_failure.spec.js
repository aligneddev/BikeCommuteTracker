import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Receipt storage failure allows expense save with notification", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_receipt_storage_failure",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and warning response", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page, {
      receiptAttached: false,
      receiptError: "Receipt could not be attached due to a storage issue. Expense recorded without receipt.",
    });
  });

  await recorder.step("open page and submit valid form with receipt", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("45.50");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 3),
    });
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert non fatal warning and success", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Receipt could not be attached due to a storage issue. Expense recorded without receipt.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("45.50");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_receipt_storage_failure");
  await recorder.save(testInfo);
});
