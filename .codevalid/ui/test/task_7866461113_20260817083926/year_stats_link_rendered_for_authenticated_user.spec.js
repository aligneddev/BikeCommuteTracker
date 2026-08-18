import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockDashboardBootstrap,
  mockYearStatsDashboard,
} from "../../helpers/mock-api.js";

test("Year Stats Dashboard link is rendered for authenticated users", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder(
    "year_stats_link_rendered_for_authenticated_user",
    "Year Stats Dashboard link is rendered for authenticated users"
  );

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Register dashboard and year-stats mocks", async () => {
    await mockDashboardBootstrap(page);
    await mockYearStatsDashboard(page);
  });

  await recorder.step("Load an authenticated page", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert the Year Stats navigation link is visible", async () => {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const yearStatsLink = nav.getByRole("link", { name: "Year Stats" });
    await expect(yearStatsLink).toBeVisible();
    await expect(yearStatsLink).toHaveAttribute("href", "/dashboard/year-stats");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Advanced Stats" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:year_stats_link_rendered_for_authenticated_user");
  await recorder.save(testInfo);
});
