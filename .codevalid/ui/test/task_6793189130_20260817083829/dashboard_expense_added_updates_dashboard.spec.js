import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockDashboardPage,
  mockRecordExpenseSuccess,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard recalculate net expense immediately after new manual expense is added", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_expense_added_updates_dashboard",
    testTitle: testInfo.title,
  });

  await recorder.step("setup session and mutable dashboard route", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);

    let dashboardState = {
      totals: {
        allTimeMiles: { miles: 3500, rideCount: 5, period: "allTime" },
        expenseSummary: {
          totalManualExpenses: 10,
          oilChangeSavings: 50,
          netExpenses: -40,
          oilChangeIntervalCount: 1,
        },
      },
    };

    await page.route("**/api/dashboard", async (route) => {
      await mockDashboardPage(page, dashboardState);
      return route.fallback();
    });

    await page.unroute("**/api/dashboard").catch(() => {});
    await page.route("**/api/dashboard", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totals: {
            currentMonthMiles: { miles: 0, rideCount: 0, period: "thisMonth" },
            yearToDateMiles: { miles: 0, rideCount: 0, period: "thisYear" },
            allTimeMiles: { miles: 3500, rideCount: 5, period: "allTime" },
            moneySaved: {
              mileageRateSavings: null,
              fuelCostAvoided: null,
              qualifiedRideCount: 0,
            },
            expenseSummary: dashboardState.totals.expenseSummary,
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

    await mockRecordExpenseSuccess(page);
    await page.route("**/api/expenses", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      dashboardState = {
        totals: {
          allTimeMiles: { miles: 3500, rideCount: 5, period: "allTime" },
          expenseSummary: {
            totalManualExpenses: 35,
            oilChangeSavings: 50,
            netExpenses: -15,
            oilChangeIntervalCount: 1,
          },
        },
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expenseId: 501,
          riderId: 1,
          savedAtUtc: "2026-08-17T08:45:00.000Z",
          receiptAttached: false,
        }),
      });
    });
  });

  await recorder.step("verify initial dashboard values", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$10.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$50.00");
  });

  await recorder.step("navigate to expense entry and add expense", async () => {
    await page.getByRole("link", { name: "Record Expense" }).click();
    await expect(page.getByRole("heading", { name: "Record Expense" })).toBeVisible();
    await page.locator('[name="expenseDate"]').fill("2026-08-17");
    await page.locator('[name="amount"]').fill("25.00");
    await page.locator('[name="note"]').fill("New chain and tune-up");
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
  });

  await recorder.step("return to dashboard and confirm recalculated values", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Total Expenses" })
    ).toContainText("$35.00");
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$50.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$15.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_expense_added_updates_dashboard");
  await recorder.save(testInfo);
});
