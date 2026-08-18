import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockAdvancedDashboardWindDistributionScenario } from "../../helpers/mock-api.js";

test("wind_resistance_histogram_visual_separation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("wind_resistance_histogram_visual_separation", testInfo.title);

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock advanced dashboard wind distribution", async () => {
    await mockAdvancedDashboardWindDistributionScenario(page);
  });

  await recorder.step("Open advanced dashboard", async () => {
    await page.goto("/dashboard/advanced");
  });

  await recorder.step("Verify wind resistance distribution labels and legend", async () => {
    await expect(page.getByRole("heading", { name: "Wind Resistance Distribution" })).toBeVisible();
    await expect(page.getByText("■ Tailwind (assisted)")).toBeVisible();
    await expect(page.getByText("■ Headwind")).toBeVisible();
    await expect(page.getByText("-2")).toBeVisible();
    await expect(page.getByText("-1")).toBeVisible();
    await expect(page.getByText("0")).toBeVisible();
    await expect(page.getByText("+1")).toBeVisible();
    await expect(page.getByText("+3")).toBeVisible();
    await expect(page.getByText("+4")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:wind_resistance_histogram_visual_separation");
  await recorder.save(testInfo);
});
