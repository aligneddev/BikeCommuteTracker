import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_optional_metrics_hidden_by_default", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_optional_metrics_hidden_by_default", testInfo.title);

  await recorder.step("Seed dashboard with pending optional suggestions only", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        suggestions: [
          {
            metricKey: "gallonsAvoided",
            title: "Estimated Gallons Avoided",
            description: "Add estimated gallons avoided to your dashboard.",
            isEnabled: false,
            value: 12.4,
            unitLabel: "gal",
          },
          {
            metricKey: "goalProgress",
            title: "Goal Progress",
            description: "Track progress toward your mileage goal.",
            isEnabled: false,
            value: 41.2,
            unitLabel: "%",
          },
        ],
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert optional metrics are not rendered in approved section by default", async () => {
    await expect(page.getByRole("heading", { name: "More metrics are available" })).toBeVisible();
    await expect(page.getByText("Estimated Gallons Avoided")).toBeVisible();
    await expect(page.getByText("Goal Progress")).toBeVisible();
    await expect(page.getByText("Approved Metric")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_optional_metrics_hidden_by_default");
  await recorder.save(testInfo);
});
