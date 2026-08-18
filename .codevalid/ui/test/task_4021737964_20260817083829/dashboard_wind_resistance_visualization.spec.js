import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_wind_resistance_visualization", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_wind_resistance_visualization", testInfo.title);

  await recorder.step("Seed advanced dashboard with wind resistance bins", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        difficultySection: {
          overallAverageDifficulty: 3.1,
          difficultyByMonth: [
            { monthNumber: 1, monthName: "January", averageDifficulty: 3.2, rideCount: 2 },
          ],
          mostDifficultMonths: [
            { monthNumber: 1, monthName: "January", averageDifficulty: 3.2, rideCount: 2 },
          ],
          windResistanceDistribution: [
            { rating: -4, rideCount: 4, label: "Strong tailwind", isAssisted: true },
            { rating: -1, rideCount: 2, label: "Light tailwind", isAssisted: true },
            { rating: 0, rideCount: 1, label: "Neutral", isAssisted: false },
            { rating: 1, rideCount: 3, label: "Light headwind", isAssisted: false },
            { rating: 4, rideCount: 5, label: "Strong headwind", isAssisted: false },
          ],
          isEmpty: false,
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert wind resistance section and legend labels are visible", async () => {
    await expect(page.getByRole("heading", { name: "Ride Difficulty" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wind Resistance Distribution" })).toBeVisible();
    await expect(page.getByText("Tailwind (assisted)")).toBeVisible();
    await expect(page.getByText("Headwind")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_wind_resistance_visualization");
  await recorder.save(testInfo);
});
