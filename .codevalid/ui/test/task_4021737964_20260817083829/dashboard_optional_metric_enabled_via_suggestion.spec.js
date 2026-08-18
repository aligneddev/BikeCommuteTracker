import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardPage,
  buildDashboardResponse,
} from "../../helpers/mock-api.js";

test("dashboard_optional_metric_enabled_via_suggestion", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_optional_metric_enabled_via_suggestion", testInfo.title);

  await recorder.step("Seed dashboard with one enabled optional metric", async () => {
    await setupAppSession(page);
    await mockDashboardPage(
      page,
      buildDashboardResponse({
        suggestions: [
          {
            metricKey: "goalProgress",
            title: "Net Savings Overview",
            description: "Approved optional metric for savings overview.",
            isEnabled: true,
            value: 45.2,
            unitLabel: null,
          },
        ],
      })
    );
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert enabled suggestion is rendered in approved metrics area", async () => {
    await expect(page.getByText("Approved Metric")).toBeVisible();
    await expect(page.getByText("45.2")).toBeVisible();
    await expect(page.getByText("Net Savings Overview")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_optional_metric_enabled_via_suggestion");
  await recorder.save(testInfo);
});
