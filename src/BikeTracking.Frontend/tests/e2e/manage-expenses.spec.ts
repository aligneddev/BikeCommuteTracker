import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordExpense } from "./support/expense-helpers";

const TEST_PIN = "87654321";

test.describe("015-manage-expenses e2e", () => {
  test("history page supports filtering, inline edit, and delete", async ({ page }) => {
    const userName = uniqueUser("e2e-manage-expense");

    await createAndLoginUser(page, userName, TEST_PIN);
    await recordExpense(page, {
      expenseDate: "2026-04-10",
      amount: "12.00",
      note: "Old tube",
    });
    await recordExpense(page, {
      expenseDate: "2026-04-17",
      amount: "28.50",
      note: "Brake pads",
    });

    await page.goto("/expenses/history");
    await expect(page.getByRole("table", { name: /expense history table/i })).toBeVisible();
    await expect(page.getByText("Brake pads")).toBeVisible();
    await expect(page.getByText("Old tube")).toBeVisible();

    await page.locator("#expense-filter-from").fill("2026-04-15");
    await page.locator("#expense-filter-to").fill("2026-04-30");
    await page.getByRole("button", { name: /apply filter/i }).click();

    await expect(page.getByText(/filtered total:\s*\$28.50/i)).toBeVisible();
    await expect(page.getByText("Brake pads")).toBeVisible();
    await expect(page.getByText("Old tube")).not.toBeVisible();

    await page.getByRole("button", { name: /edit expense/i }).click();
    await page.getByLabel("Edit amount").fill("35.75");
    await page.getByLabel("Edit notes").fill("Brake pads and cable")
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/expense updated/i)).toBeVisible();
    await expect(page.getByText("Brake pads and cable")).toBeVisible();
    await expect(page.getByText("$35.75", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /delete expense/i }).click();

    await expect(page.getByText(/expense deleted/i)).toBeVisible();
    await expect(page.getByText(/no expenses found/i)).toBeVisible();
    await expect(page.getByText(/filtered total:\s*\$0.00/i)).toBeVisible();
  });
});