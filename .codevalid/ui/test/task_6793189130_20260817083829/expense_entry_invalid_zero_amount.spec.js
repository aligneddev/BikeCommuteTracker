import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_invalid_zero_amount", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_zero_amount",
    testTitle: "Expense fails validation with zero amount",
  });

  await recorder.step("seed authenticated rider", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page);
  });

  await recorder.step("enter valid date and zero amount", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("0");
  });

  await recorder.step("submit invalid amount", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert zero rejected", async () => {
    await expect(page.getByText("Amount must be greater than zero")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_zero_amount");
  await recorder.save(testInfo);
});
