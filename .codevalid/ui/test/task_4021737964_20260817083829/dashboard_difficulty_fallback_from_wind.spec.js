import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_difficulty_fallback_from_wind", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_difficulty_fallback_from_wind", testInfo.title);

  await recorder.step("Seed difficulty analytics with mapped fallback values already aggregated by API", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        difficultySection: {
          overallAverageDifficulty: 2.4,
          difficultyByMonth: [
            { monthNumber: 3, monthName: "March", averageDifficulty: 3.8, rideCount: 3 },
            { monthNumber: 2, monthName: "February", averageDifficulty: 2.0, rideCount: 2 },
          ],
          mostDifficultMonths: [
            { monthNumber: 3, monthName: "March", averageDifficulty: 3.8, rideCount: 3 },
            { monthNumber: 2, monthName: "February", averageDifficulty: 2.0, rideCount: 2 },
          ],
          windResistanceDistribution: [
            { rating: -3, rideCount: 1, label: "Tailwind", isAssisted: true },
            { rating: -2, rideCount: 1, label: "Tailwind", isAssisted: true },
            { rating: 0, rideCount: 1, label: "Neutral", isAssisted: false },
            { rating: 2, rideCount: 1, label: "Headwind", isAssisted: false },
            { rating: 3, rideCount: 1, label: "Headwind", isAssisted: false },
          ],
          isEmpty: false,
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert overall difficulty and ranked months are shown", async () => {
    await expect(page.getByText("2.4")).toBeVisible();
    await expect(page.getByText("/ 5 overall average")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toBeVisible();
    await expect(page.getByText("March")).toBeVisible();
    await expect(page.getByText("3.8")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_difficulty_fallback_from_wind");
  await recorder.save(testInfo);
});
