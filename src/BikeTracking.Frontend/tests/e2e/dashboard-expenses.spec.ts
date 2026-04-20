import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import {
  expenseSummaryCard,
  expenseSummaryRow,
  recordExpense,
} from "./support/expense-helpers";

const TEST_PIN = "87654321";

test.describe("015-dashboard-expenses e2e", () => {
  test("recording an expense updates dashboard expense totals", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-dashboard-expense");

    await createAndLoginUser(page, userName, TEST_PIN);
    await recordExpense(page, {
      expenseDate: "2026-04-17",
      amount: "42.50",
      note: "Chain lube and degreaser",
    });

    await page.goto("/dashboard");

    const card = expenseSummaryCard(page);
    await expect(card).toBeVisible();
    await expect(expenseSummaryRow(card, "Total Expenses")).toContainText(
      "$42.50",
    );
    await expect(expenseSummaryRow(card, "Oil Change Savings")).toContainText(
      "—",
    );
    await expect(expenseSummaryRow(card, "Net Expenses")).toContainText("—");
  });
});
