import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  mockCommonAppRoutes,
  mockSettingsPageData,
  setupAppSession,
} from "../../helpers/mock-api.js";

test("Dashboard recalculates net expense immediately after oil-change price is modified", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "dashboard_oil_price_changed_updates_dashboard",
    testTitle: testInfo.title,
  });

  await recorder.step("setup mutable settings and dashboard mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);

    let oilChangePrice = 40;
    await mockSettingsPageData(page, {
      settings: {
        averageCarMpg: null,
        yearlyGoalMiles: null,
        oilChangePrice,
        mileageRateCents: null,
        locationLabel: null,
        latitude: null,
        longitude: null,
        dashboardGallonsAvoidedEnabled: false,
        dashboardGoalProgressEnabled: false,
        weatherApiKey: null,
        eiaGasApiKey: null,
      },
      presets: [],
    });

    await page.route("**/api/users/settings", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            settings: {
              averageCarMpg: null,
              yearlyGoalMiles: null,
              oilChangePrice,
              mileageRateCents: null,
              locationLabel: null,
              latitude: null,
              longitude: null,
              dashboardGallonsAvoidedEnabled: false,
              dashboardGoalProgressEnabled: false,
              weatherApiKey: null,
              eiaGasApiKey: null,
            },
          }),
        });
      }
      if (method === "PUT") {
        const body = route.request().postDataJSON();
        oilChangePrice = body.oilChangePrice;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ settings: { ...body } }),
        });
      }
      return route.fallback();
    });

    await page.route("**/api/dashboard", async (route) => {
      const intervals = 2;
      const totalManualExpenses = 85;
      const oilChangeSavings = intervals * oilChangePrice;
      const netExpenses = totalManualExpenses - oilChangeSavings;

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totals: {
            currentMonthMiles: { miles: 0, rideCount: 0, period: "thisMonth" },
            yearToDateMiles: { miles: 0, rideCount: 0, period: "thisYear" },
            allTimeMiles: { miles: 6700, rideCount: 9, period: "allTime" },
            moneySaved: {
              mileageRateSavings: null,
              fuelCostAvoided: null,
              qualifiedRideCount: 0,
            },
            expenseSummary: {
              totalManualExpenses,
              oilChangeSavings,
              netExpenses,
              oilChangeIntervalCount: intervals,
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
  });

  await recorder.step("verify initial dashboard values", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$80.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$5.00");
  });

  await recorder.step("navigate to settings and update oil change price", async () => {
    await page.getByRole("button").filter({ hasText: "test-rider" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.locator('input[name="oilChangePrice"]').fill("60");
    await page.getByRole("button", { name: /save/i }).click();
  });

  await recorder.step("return to dashboard and verify recalculated totals", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByText("Expense Summary")).toBeVisible();
    await expect(
      page.locator(".expense-summary-card-row").filter({ hasText: "Oil Change Savings" })
    ).toContainText("$120.00");
    await expect(
      page.locator(".expense-summary-card-row-net-savings")
    ).toContainText("-$35.00");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_oil_price_changed_updates_dashboard");
  await recorder.save(testInfo);
});
