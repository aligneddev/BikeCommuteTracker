import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardDifficultyTwelveMonthsScenario } from "../../helpers/mock-api.js";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

test("ride_difficulty_most_difficult_months_12_groups", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("ride_difficulty_most_difficult_months_12_groups", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard with 12 month groups", async () => {
    await mockAdvancedDashboardDifficultyTwelveMonthsScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify all 12 calendar month groups are rendered", async () => {
    await expect(page.getByRole("heading", { name: "Most Difficult Months" })).toBeVisible();
    for (const month of months) {
      await expect(page.getByText(month)).toBeVisible();
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_difficulty_most_difficult_months_12_groups");
  await recorder.save(testInfo);
});
