import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEntryScenario,
} from "../../helpers/mock-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const receiptPath = path.resolve(__dirname, "../../mock/fixtures/receipt-valid.jpg");

test("expense_entry_valid_input_with_receipt", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_input_with_receipt",
    testTitle: "Valid expense with date, amount, note, and valid receipt",
  });

  await recorder.step("seed authenticated rider and receipt-attached expense scenario", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEntryScenario(page, {
      postResponse: { receiptAttached: true },
      historyAfterSave: [
        {
          expenseId: 502,
          expenseDate: "2024-06-15T00:00:00.000Z",
          amount: 45.99,
          notes: "New brake pads",
          hasReceipt: true,
          version: 1,
          createdAtUtc: "2026-08-17T08:45:00.000Z",
        },
      ],
    });
  });

  await recorder.step("open entry page and fill all fields", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("45.99");
    await page.locator('[name="note"]').fill("New brake pads");
    await page.locator('[name="receipt"]').setInputFiles(receiptPath);
  });

  await recorder.step("submit expense with valid receipt", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  await recorder.step("verify receipt-backed row in expense history", async () => {
    await page.goto("/expenses/history");
    await expect(page.getByText("$45.99")).toBeVisible();
    await expect(page.getByText("New brake pads")).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download receipt" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_input_with_receipt");
  await recorder.save(testInfo);
});
