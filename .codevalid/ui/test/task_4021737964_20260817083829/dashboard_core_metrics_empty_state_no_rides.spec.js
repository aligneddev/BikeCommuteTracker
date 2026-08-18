import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_core_metrics_empty_state_no_rides", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_core_metrics_empty_state_no_rides", testInfo.title);

  await recorder.step("Seed authenticated session with zero-ride dashboard response", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        totals: {
          currentMonthMiles: { miles: 0, rideCount: 0, period: "thisMonth" },
          yearToDateMiles: { miles: 0, rideCount: 0, period: "thisYear" },
          allTimeMiles: { miles: 0, rideCount: 0, period: "allTime" },
        },
        averages: {
          averageTemperature: null,
          averageMilesPerRide: null,
          averageRideMinutes: null,
        },
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert empty-state messaging is descriptive and non-breaking", async () => {
    await expect(page.getByRole("heading", { name: "No ride history yet" })).toBeVisible();
    await expect(page.getByText("Record a commute to start building your dashboard totals, averages, and monthly trends.")).toBeVisible();
    await expect(page.getByText("Average temperature")).toBeVisible();
    await expect(page.getByText("Average miles per ride")).toBeVisible();
    await expect(page.getByText("Average ride duration")).toBeVisible();
    await expect(page.getByText("—")).toHaveCount(3);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_core_metrics_empty_state_no_rides");
  await recorder.save(testInfo);
});
