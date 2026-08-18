import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardMileageStatisticsScenario } from "../../helpers/mock-api.js";

test("dashboard_mileage_statistics_calculated", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_mileage_statistics_calculated", testInfo.title);

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard mileage statistics payload", async () => {
    await mockDashboardMileageStatisticsScenario(page);
  });

  await recorder.step("Open dashboard page", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify mileage cards show expected totals", async () => {
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Current Month")).toBeVisible();
    await expect(page.getByText("15.0 mi")).toBeVisible();
    await expect(page.getByText("Year to Date")).toBeVisible();
    await expect(page.getByText("60.0 mi")).toBeVisible();
    await expect(page.getByText("All Time")).toBeVisible();
    await expect(page.getByText("3 rides")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_mileage_statistics_calculated");
  await recorder.save(testInfo);
});
