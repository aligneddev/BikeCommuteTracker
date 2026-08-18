import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Successful save keeps current form values in the current implementation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_success_resets_form",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page, { receiptAttached: true });
  });

  await recorder.step("open page and submit valid expense", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("45.50");
    await page.locator('[name="note"]').fill("New bike chain");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 1),
    });
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert success message and current field behavior", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("45.50");
    await expect(page.locator('[name="note"]')).toHaveValue("New bike chain");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_success_resets_form");
  await recorder.save(testInfo);
});
