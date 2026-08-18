import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Retry can be used repeatedly after consecutive timeouts", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "retry_after_multiple_timeouts",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
    await page.addInitScript(() => {
      window.__healthRequestCount = 0;
    });
  });

  await recorder.step("mock persistent unready health responses", async () => {
    await page.route("**/health", async (route) => {
      await page.evaluate(() => {
        window.__healthRequestCount += 1;
      });
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Still starting" }),
      });
    });
  });

  await recorder.step("launch and wait for first timeout", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
  });

  await recorder.step("use retry after first timeout", async () => {
    const afterFirstTimeout = await page.evaluate(() => window.__healthRequestCount);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.__healthRequestCount)).toBeGreaterThan(afterFirstTimeout);
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
  });

  await recorder.step("use retry again after second timeout", async () => {
    const afterSecondTimeout = await page.evaluate(() => window.__healthRequestCount);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.__healthRequestCount)).toBeGreaterThan(afterSecondTimeout);
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:retry_after_multiple_timeouts");
  await recorder.save(testInfo);
});
