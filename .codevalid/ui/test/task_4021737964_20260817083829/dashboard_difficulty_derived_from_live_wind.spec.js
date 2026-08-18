import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_difficulty_derived_from_live_wind", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_difficulty_derived_from_live_wind", testInfo.title);

  await recorder.step("Seed advanced dashboard with derived difficulty analytics", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        difficultySection: {
          overallAverageDifficulty: 3.6,
          difficultyByMonth: [
            { monthNumber: 4, monthName: "April", averageDifficulty: 4.2, rideCount: 2 },
            { monthNumber: 5, monthName: "May", averageDifficulty: 3.0, rideCount: 3 },
          ],
          mostDifficultMonths: [
            { monthNumber: 4, monthName: "April", averageDifficulty: 4.2, rideCount: 2 },
            { monthNumber: 5, monthName: "May", averageDifficulty: 3.0, rideCount: 3 },
          ],
          windResistanceDistribution: [
            { rating: 1, rideCount: 1, label: "Light headwind", isAssisted: false },
            { rating: 2, rideCount: 2, label: "Moderate headwind", isAssisted: false },
            { rating: 4, rideCount: 2, label: "Strong headwind", isAssisted: false },
          ],
          isEmpty: false,
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert derived difficulty analytics render without empty-state failure", async () => {
    await expect(page.getByRole("heading", { name: "Average Difficulty by Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toBeVisible();
    await expect(page.getByText("Record rides with travel direction to see difficulty trends.")).toHaveCount(0);
    await expect(page.getByText("3.6")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_difficulty_derived_from_live_wind");
  await recorder.save(testInfo);
});
