import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockDashboardBootstrap,
  mockYearStatsDashboard,
} from "../../helpers/mock-api.js";

test("Clicking Year Stats Dashboard link navigates to /dashboard/year-stats", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder(
    "year_stats_link_navigates_to_correct_route",
    "Clicking Year Stats Dashboard link navigates to /dashboard/year-stats"
  );

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Register dashboard and year-stats mocks", async () => {
    await mockDashboardBootstrap(page);
    await mockYearStatsDashboard(page);
  });

  await recorder.step("Open the dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
  });

  await recorder.step("Click the Year Stats link", async () => {
    await page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Year Stats" })
      .click();
  });

  await recorder.step("Assert in-app navigation to the Year Stats dashboard", async () => {
    await expect(page).toHaveURL(/\/dashboard\/year-stats$/);
    await expect(page.getByRole("heading", { name: "Pick a year, see the whole story." })).toBeVisible();
    await expect(page.getByText("Mileage, savings, and ride difficulty for exactly the calendar year you choose.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:year_stats_link_navigates_to_correct_route");
  await recorder.save(testInfo);
});
