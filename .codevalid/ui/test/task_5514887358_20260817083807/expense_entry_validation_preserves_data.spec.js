import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Form data is preserved across validation failures", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_validation_preserves_data",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and submit with missing date", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="amount"]').fill("30.00");
    await page.locator('[name="note"]').fill("Bike tune-up");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(1024, 8),
    });
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert validation and preserved values", async () => {
    await expect(page.getByText("Expense date is required")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("");
    await expect(page.locator('[name="amount"]')).toHaveValue("30.00");
    await expect(page.locator('[name="note"]')).toHaveValue("Bike tune-up");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_validation_preserves_data");
  await recorder.save(testInfo);
});
