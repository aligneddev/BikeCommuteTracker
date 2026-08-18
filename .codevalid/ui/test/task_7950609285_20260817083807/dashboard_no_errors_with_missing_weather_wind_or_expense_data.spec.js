import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockDashboardPartialDataScenario, mockAdvancedDashboardPartialDataScenario } from "../../helpers/mock-api.js";

test("dashboard_no_errors_with_missing_weather_wind_or_expense_data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_no_errors_with_missing_weather_wind_or_expense_data", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock dashboard and advanced dashboard partial-data responses", async () => {
    await mockDashboardPartialDataScenario(page);
    await mockAdvancedDashboardPartialDataScenario(page);
  });

  await recorder.step("Open core dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify average temperature renders from partial weather data", async () => {
    await expect(page.getByText("Average temperature")).toBeVisible();
    await expect(page.getByText("68.0°F")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Some metrics are still filling in" })).toBeVisible();
  });

  await recorder.step("Open advanced dashboard and verify wind data section still renders", async () => {
    await page.goto("/dashboard/advanced");
    await expect(page.getByRole("heading", { name: "Wind Resistance Distribution" })).toBeVisible();
    await expect(page.getByText("■ Tailwind (assisted)")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_no_errors_with_missing_weather_wind_or_expense_data");
  await recorder.save(testInfo);
});
