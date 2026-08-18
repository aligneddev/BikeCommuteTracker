import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Deleted expense does not reappear after being edited and then deleted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_delete_after_edit_preserves_change",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and stateful edit/delete routes", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);

    let expensesState = [
      {
        expenseId: 501,
        expenseDate: "2024-05-10T00:00:00.000Z",
        amount: 20,
        notes: "Original",
        hasReceipt: false,
        version: 1,
        createdAtUtc: "2024-05-10T09:00:00.000Z",
      },
    ];

    await page.route("**/api/expenses*", async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());

      const json = (status, body) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (method === "GET" && url.pathname.endsWith("/api/expenses")) {
        const totalAmount = expensesState.reduce((sum, item) => sum + item.amount, 0);
        return json(200, {
          expenses: expensesState,
          totalAmount,
          expenseCount: expensesState.length,
          generatedAtUtc: "2026-08-17T08:30:00.000Z",
        });
      }

      if (method === "PUT" && /\/api\/expenses\/\d+$/.test(url.pathname)) {
        const expenseId = Number(url.pathname.split("/").pop());
        const body = route.request().postDataJSON();
        expensesState = expensesState.map((expense) =>
          expense.expenseId === expenseId
            ? {
                ...expense,
                expenseDate: `${body.expenseDate}T00:00:00.000Z`,
                amount: body.amount,
                notes: body.notes ?? expense.notes,
                version: expense.version + 1,
              }
            : expense
        );
        return json(200, {
          expenseId,
          savedAtUtc: "2026-08-17T08:35:00.000Z",
          newVersion: 2,
        });
      }

      if (method === "DELETE" && /\/api\/expenses\/\d+$/.test(url.pathname)) {
        const expenseId = Number(url.pathname.split("/").pop());
        expensesState = expensesState.filter((expense) => expense.expenseId !== expenseId);
        return json(200, {
          expenseId,
          deletedAtUtc: "2026-08-17T08:40:00.000Z",
        });
      }

      return route.fallback();
    });
  });

  await recorder.step("Edit expense and save new values", async () => {
    await page.goto("/expenses/history");
    await page.getByRole("button", { name: "Edit expense" }).click();
    await page.getByLabel("Edit date").fill("2024-06-01");
    await page.getByLabel("Edit amount").fill("25.00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Expense updated")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("2024-06-01");
    await expect(page.locator("tbody tr").first()).toContainText("$25.00");
  });

  await recorder.step("Delete updated expense and verify it stays gone", async () => {
    await page.getByRole("button", { name: "Delete expense" }).click();
    await expect(page.getByText("Expense deleted")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByText("No expenses found.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_delete_after_edit_preserves_change");
  await recorder.save(testInfo);
});
