import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

const longNote = "a".repeat(501);

test("expense_entry_note_too_long", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_note_too_long",
    testTitle: "Expense fails validation with note exceeding 500 characters",
  });

  await recorder.step("seed authenticated rider", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page);
  });

  await recorder.step("fill overlong note", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("15.00");
    await page.locator('[name="note"]').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, longNote);
  });

  await recorder.step("submit invalid note", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert note validation", async () => {
    await expect(page.getByText("Note must be 500 characters or fewer")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_note_too_long");
  await recorder.save(testInfo);
});
