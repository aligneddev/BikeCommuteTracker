import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard recalculate net expense immediately after an expense is deleted", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_expense_deleted_updates_dashboard",
    testTitle: testInfo.title,
  });

  await recorder.step("setup dashboard and expense history state", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);

    let expensesState = [
      {
        expenseId: 401,
        expenseDate: "2026-08-10T00:00:00.000Z",
        amount: 40,
        notes: "Repair stand",
        hasReceipt: false,
        version: 1,
        createdAtUtc: "2026-08-10T12:00:00.000Z",
      },
      {
        expenseId: 402,
        expenseDate: "2026-08-05T00:00:00.000Z",
        amount: 15,
        notes: "Tube",
        hasReceipt: false,
        version: 1,
        createdAtUtc: "2026-08-05T12:00:00.000Z",
      },
    ];

    await page.route("**/api/dashboard", async (route) => {
      const totalManualExpenses = expensesState.reduce((sum, item) => sum + item.amount, 0);
      const oilChangeSavings = 120;
      const netExpenses = totalManualExpenses - oilChangeSavings;

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totals: {
            currentMonthMiles: { miles: 0, rideCount: 0, period: "thisMonth" },
            yearToDateMiles: { miles: 0, rideCount: 0, period: "thisYear" },
            allTimeMiles: { miles: 6000, rideCount: 8, period: "allTime" },
            moneySaved: {
              mileageRateSavings: null,
              fuelCostAvoided: null,
              qualifiedRideCount: 0,
            },
            expenseSummary: {
              totalManualExpenses,
              oilChangeSavings,
              netExpenses,
              oilChangeIntervalCount: 2,
            },
          },
          averages: {
            averageTemperature: null,
            averageMilesPerRide: null,
            averageRideMinutes: null,
          },
          charts: {
            mileageByMonth: [],
            savingsByMonth: [],
          },
          suggestions: [],
          missingData: {
            ridesMissingSavingsSnapshot: 0,
            ridesMissingGasPrice: 0,
            ridesMissingTemperature: 0,
            ridesMissingDuration: 0,
          },
          generatedAtUtc: "2026-08-17T08:30:00.000Z",
        }),
      });
    });

    await page.route("**/api/expenses*", async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());

      if (method === "GET" && url.pathname.endsWith("/api/expenses")) {
        const totalAmount = expensesState.reduce((sum, item) => sum + item.amount, 0);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            expenses: expensesState,
            totalAmount,
            expenseCount: expensesState.length,
            generatedAtUtc: "2026-08-17T08:30:00.000Z",
          }),
        });
      }

      if (method === "DELETE" && /\/api\/expenses\/\d+$/.test(url.pathname)) {
        const expenseId = Number(url.pathname.split("/").pop());
        expensesState = expensesState.filter((expense) => expense.expenseId !== expenseId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ expenseId, deletedAtUtc: "2026-08-17T08:40:00.000Z" }),
        });
      }

      return route.fallback();
    });
  });

  await recorder.step("open dashboard and verify initial totals", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$55.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$65.00");
  });

  await recorder.step("delete forty dollar expense from expense history", async () => {
    await page.getByRole("link", { name: "Expense History" }).click();
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: "$40.00" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete expense" }).click();
    await expect(page.getByText("Expense deleted")).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: "$40.00" })).toHaveCount(0);
  });

  await recorder.step("return to dashboard and verify updated totals", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$15.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$120.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$105.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_expense_deleted_updates_dashboard");
  await recorder.save(testInfo);
});
