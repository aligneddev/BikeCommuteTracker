import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardOptionalMetricsScenario } from "../../helpers/mock-api.js";

test("optional_metrics_configurable", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("optional_metrics_configurable", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard response with approved optional metrics", async () => {
    await mockDashboardOptionalMetricsScenario(page);
  });

  await recorder.step("Open dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify approved optional metrics render and hidden suggestion stays absent", async () => {
    await expect(page.getByRole("heading", { name: "More metrics are available" })).toBeVisible();
    await expect(page.getByText("Estimated Gallons Avoided")).toBeVisible();
    await expect(page.getByText("Goal Progress")).toBeVisible();
    await expect(page.getByText("Net Savings Summary")).not.toBeVisible();
  });

  await recorder.step("Refresh and verify metrics persist in mocked profile response", async () => {
    await page.reload();
    await expect(page.getByText("Estimated Gallons Avoided")).toBeVisible();
    await expect(page.getByText("Goal Progress")).toBeVisible();
    await expect(page.getByText("Net Savings Summary")).not.toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:optional_metrics_configurable");
  await recorder.save(testInfo);
});
