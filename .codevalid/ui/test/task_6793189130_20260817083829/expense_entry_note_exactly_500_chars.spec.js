import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

const exactNote = "a".repeat(500);

test("expense_entry_note_exactly_500_chars", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_note_exactly_500_chars",
    testTitle: "Expense accepts note with exactly 500 characters",
  });

  await recorder.step("seed authenticated rider and saved history", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: false },
      historyAfterSave: [
        {
          expenseId: 503,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 12,
          notes: exactNote,
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("fill valid 500 char note and submit", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("12.00");
    await page.locator('[name="note"]').fill(exactNote);
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert success and note persisted into history", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Note must be 500 characters or fewer")).toHaveCount(0);
    await page.goto("/expenses/history");
    await expect(page.getByText("$12.00")).toBeVisible();
    await expect(page.getByText(exactNote)).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_note_exactly_500_chars");
  await recorder.save(testInfo);
});
