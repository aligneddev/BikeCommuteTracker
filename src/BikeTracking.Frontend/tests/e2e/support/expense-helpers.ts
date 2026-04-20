import { expect, type Locator, type Page } from "@playwright/test";

export interface ExpenseFormInput {
  expenseDate: string;
  amount: string;
  note?: string;
}

export async function recordExpense(
  page: Page,
  input: ExpenseFormInput,
): Promise<void> {
  await page.goto("/expenses/entry");
  await page.locator("#expense-date").fill(input.expenseDate);
  await page.locator("#expense-amount").fill(input.amount);

  if (input.note !== undefined) {
    await page.locator("#expense-note").fill(input.note);
  }

  await page.getByRole("button", { name: "Record Expense" }).click();
  await expect(page.getByText(/expense recorded successfully/i)).toBeVisible();
}

export function expenseSummaryCard(page: Page): Locator {
  return page.locator("article", {
    has: page.getByRole("heading", { name: "Expense Summary" }),
  });
}

export function expenseSummaryRow(card: Locator, label: string): Locator {
  return card.locator(".expense-summary-card-row", {
    hasText: label,
  });
}
