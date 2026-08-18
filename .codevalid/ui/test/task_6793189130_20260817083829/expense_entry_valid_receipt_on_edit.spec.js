import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupExpenseEditScenario,
} from "../../helpers/mock-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const replaceReceiptPath = path.resolve(__dirname, "../../mock/fixtures/receipt-valid.png");

test("expense_entry_valid_receipt_on_edit", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_receipt_on_edit",
    testTitle: "Receipt can be added to existing expense during edit",
  });

  await recorder.step("seed authenticated rider with editable expense lacking receipt", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupExpenseEditScenario(page, {
      expenses: [
        {
          expenseId: 301,
          expenseDate: "2024-06-10T00:00:00.000Z",
          amount: 10,
          notes: "Bike repair",
          hasReceipt: false,
          version: 1,
          createdAtUtc: "2024-06-10T08:00:00.000Z",
        },
      ],
      receiptUploadedExpenseIds: [301],
    });
  });

  await recorder.step("open history and start editing", async () => {
    await page.goto("/expenses/history");
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    await page.getByRole("button", { name: "Edit expense" }).click();
  });

  await recorder.step("upload replacement receipt and save edit", async () => {
    await page.getByLabel("Replace receipt").setInputFiles(replaceReceiptPath);
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("assert update success and receipt indicator shown", async () => {
    await expect(page.getByText("Expense updated")).toBeVisible();
    await expect(page.getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download receipt" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_receipt_on_edit");
  await recorder.save(testInfo);
});
