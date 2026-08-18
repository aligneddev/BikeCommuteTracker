import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_core_metrics_rendered_with_data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_core_metrics_rendered_with_data", testInfo.title);

  await recorder.step("Seed authenticated session and dashboard data", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        totals: {
          currentMonthMiles: { miles: 42, rideCount: 3, period: "thisMonth" },
          yearToDateMiles: { miles: 315, rideCount: 12, period: "thisYear" },
          allTimeMiles: { miles: 1200, rideCount: 45, period: "allTime" },
          moneySaved: {
            mileageRateSavings: 120.5,
            fuelCostAvoided: 85.2,
            qualifiedRideCount: 3,
          },
        },
        averages: {
          averageTemperature: 68.4,
          averageMilesPerRide: 14.2,
          averageRideMinutes: 37.5,
        },
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert main dashboard headings and metric values", async () => {
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Current Month")).toBeVisible();
    await expect(page.getByText("42.0 mi")).toBeVisible();
    await expect(page.getByText("Year to Date")).toBeVisible();
    await expect(page.getByText("315.0 mi")).toBeVisible();
    await expect(page.getByText("All Time")).toBeVisible();
    await expect(page.getByText("1200.0 mi")).toBeVisible();
    await expect(page.getByText("Average temperature")).toBeVisible();
    await expect(page.getByText("68.4°F")).toBeVisible();
    await expect(page.getByText("Average miles per ride")).toBeVisible();
    await expect(page.getByText("14.2 mi")).toBeVisible();
    await expect(page.getByText("Average ride duration")).toBeVisible();
    await expect(page.getByText("37.5 min")).toBeVisible();
    await expect(page.getByText("Loading charts…")).toHaveCount(0);
    await expect(page.getByText("Refreshing dashboard…")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_core_metrics_rendered_with_data");
  await recorder.save(testInfo);
});
