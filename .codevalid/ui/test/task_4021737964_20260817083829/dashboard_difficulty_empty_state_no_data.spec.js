import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockAdvancedDashboardPage,
  buildAdvancedDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_difficulty_empty_state_no_data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_difficulty_empty_state_no_data", testInfo.title);

  await recorder.step("Seed advanced dashboard with empty difficulty section", async () => {
    await setupAppSession(page);
    await mockAdvancedDashboardPage(
      page,
      buildAdvancedDashboardResponse({
        difficultySection: {
          overallAverageDifficulty: null,
          difficultyByMonth: [],
          mostDifficultMonths: [],
          windResistanceDistribution: [],
          isEmpty: true,
        },
      })
    );
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Assert descriptive empty-state text appears", async () => {
    await expect(page.getByText("Record rides with travel direction to see difficulty trends.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ride Difficulty" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_difficulty_empty_state_no_data");
  await recorder.save(testInfo);
});
