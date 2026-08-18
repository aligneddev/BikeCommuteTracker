import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockDashboardApis,
  buildDashboardResponse,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Oil-change savings calculated from lifetime miles and configured price", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "oil_change_savings_calculated_when_settings_set",
    testTitle: testInfo.title,
  });

  await recorder.step("seed dashboard response with expense summary", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page, {
      dashboard: buildDashboardResponse({
        totals: {
          allTimeMiles: { miles: 8200, rideCount: 10, period: "allTime" },
          expenseSummary: {
            totalManualExpenses: 150,
            oilChangeSavings: 90,
            netExpenses: 60,
            oilChangeIntervalCount: 2,
          },
        },
      }),
    });
  });

  await recorder.step("open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("assert oil change savings display", async () => {
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Oil Change Savings")).toBeVisible();
    await expect(page.getByText("$90.00")).toBeVisible();
    await expect(page.getByText("2 oil change intervals avoided")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:oil_change_savings_calculated_when_settings_set");
  await recorder.save(testInfo);
});
