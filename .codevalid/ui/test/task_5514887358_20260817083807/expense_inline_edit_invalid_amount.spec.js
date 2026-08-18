import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  setupExpenseEditScenario,
} from "../../helpers/mock-api.js";

test("Inline edit blocks non-positive amount with validation message", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_inline_edit_invalid_amount",
    testTitle: testInfo.title,
  });

  const expense = {
    expenseId: 302,
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

  await recorder.step("Open edit mode and enter invalid amount", async () => {
    await page.goto("/expenses/history");
    await page.getByRole("button", { name: "Edit expense" }).click();
    await page.getByLabel("Edit amount").fill("-5.00");
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("Assert validation error and preserved edit state", async () => {
    await expect(page.getByRole("alert")).toContainText("Amount must be greater than zero");
    await expect(page.getByLabel("Edit amount")).toHaveValue("-5.00");
    await expect(page.getByLabel("Edit date")).toHaveValue("2024-05-10");
    await expect(page.getByLabel("Edit notes")).toHaveValue("Old chain");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_inline_edit_invalid_amount");
  await recorder.save(testInfo);
});
