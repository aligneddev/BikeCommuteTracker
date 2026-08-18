import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_average_temperature_rendered", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_average_temperature_rendered", testInfo.title);

  await recorder.step("Seed dashboard with average temperature from valid rides only", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        averages: {
          averageTemperature: 70.1,
          averageMilesPerRide: 9.5,
          averageRideMinutes: 24.4,
        },
        missingData: {
          ridesMissingSavingsSnapshot: 0,
          ridesMissingGasPrice: 0,
          ridesMissingTemperature: 3,
          ridesMissingDuration: 0,
        },
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert average temperature and partial-data note are visible", async () => {
    await expect(page.getByText("Average temperature")).toBeVisible();
    await expect(page.getByText("70.1°F")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Some metrics are still filling in" })).toBeVisible();
    await expect(page.getByText("3 rides are missing temperatures.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_average_temperature_rendered");
  await recorder.save(testInfo);
});
