import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  setupExpenseEditScenario,
} from "../../helpers/mock-api.js";

test("Inline editing allows valid updates to date, amount, and note", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_inline_edit_valid_fields",
    testTitle: testInfo.title,
  });

  const expense = {
    expenseId: 301,
    expenseDate: "2024-05-10T00:00:00.000Z",
    amount: 24.99,
    notes: "Old chain",
    hasReceipt: false,
    version: 1,
    createdAtUtc: "2024-05-10T09:00:00.000Z",
  };

  await recorder.step("Arrange authenticated session and editable expense", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEditScenario(page, { expenses: [expense] });
  });

  await recorder.step("Open expense history page", async () => {
    await page.goto("/expenses/history");
  });

  await recorder.step("Enter edit mode and update fields", async () => {
    await page.getByRole("button", { name: "Edit expense" }).click();
    await page.getByLabel("Edit date").fill("2024-06-20");
    await page.getByLabel("Edit amount").fill("32.50");
    await page.getByLabel("Edit notes").fill("New, more expensive chain");
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("Assert updated values are displayed", async () => {
    await expect(page.getByText("Expense updated")).toBeVisible();
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("2024-06-20");
    await expect(row).toContainText("$32.50");
    await expect(row).toContainText("New, more expensive chain");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_inline_edit_valid_fields");
  await recorder.save(testInfo);
});
