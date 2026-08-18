import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  setupExpenseEditScenario,
} from "../../helpers/mock-api.js";

test("Inline edit allows replacing an existing receipt", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_inline_edit_receipt_replace",
    testTitle: testInfo.title,
  });

  const expense = {
    expenseId: 303,
    expenseDate: "2024-06-15T00:00:00.000Z",
    amount: 24.5,
    notes: "Oil change",
    hasReceipt: true,
    version: 1,
    createdAtUtc: "2024-06-15T12:00:00.000Z",
  };

  await recorder.step("Arrange authenticated session and expense with receipt", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEditScenario(page, { expenses: [expense] });
  });

  await recorder.step("Open expense history and replace receipt", async () => {
    await page.goto("/expenses/history");
    await page.getByRole("button", { name: "Edit expense" }).click();
    await page.getByLabel("Replace receipt").setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png"),
    });
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("Assert update succeeded and receipt actions remain visible", async () => {
    await expect(page.getByText("Expense updated")).toBeVisible();
    const row = page.locator("tbody tr").first();
    await expect(row.getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Download receipt" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_inline_edit_receipt_replace");
  await recorder.save(testInfo);
});
