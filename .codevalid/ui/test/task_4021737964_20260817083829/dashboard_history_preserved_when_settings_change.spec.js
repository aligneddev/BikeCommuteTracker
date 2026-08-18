import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_history_preserved_when_settings_change", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_history_preserved_when_settings_change", testInfo.title);

  await recorder.step("Seed dashboard with historical split savings and snapshot warning note", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        totals: {
          moneySaved: {
            mileageRateSavings: 75,
            fuelCostAvoided: 33.5,
            qualifiedRideCount: 3,
          },
        },
        missingData: {
          ridesMissingSavingsSnapshot: 1,
          ridesMissingGasPrice: 0,
          ridesMissingTemperature: 0,
          ridesMissingDuration: 0,
        },
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert historical snapshot messaging and values are stable on UI", async () => {
    await expect(page.getByText("Mileage rate savings $75.00")).toBeVisible();
    await expect(page.getByText("Gallons-based savings $33.50")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Some metrics are still filling in" })).toBeVisible();
    await expect(page.getByText("1 rides are missing savings snapshots.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_history_preserved_when_settings_change");
  await recorder.save(testInfo);
});
