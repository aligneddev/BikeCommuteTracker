import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

test("expense_entry_invalid_empty_date", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_empty_date",
    testTitle: "Expense fails validation with empty date",
  });

  await recorder.step("seed authenticated rider", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page);
  });

  await recorder.step("open entry page and leave date empty", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="amount"]').fill("30.00");
    await page.locator('[name="note"]').fill("Lube");
  });

  await recorder.step("submit invalid form", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert date validation and preserved input", async () => {
    await expect(page.getByText("Expense date is required")).toBeVisible();
    await expect(page.locator('[name="amount"]')).toHaveValue("30.00");
    await expect(page.locator('[name="note"]')).toHaveValue("Lube");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_empty_date");
  await recorder.save(testInfo);
});
