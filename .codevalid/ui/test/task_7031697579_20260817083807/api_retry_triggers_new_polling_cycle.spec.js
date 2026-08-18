import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("User click on Retry triggers a new API health polling sequence", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_retry_triggers_new_polling_cycle",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
    await page.addInitScript(() => {
      window.__healthRequestCount = 0;
    });
  });

  await recorder.step("mock unready health responses and count requests", async () => {
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

  await recorder.step("click retry and verify a new polling cycle starts", async () => {
    const firstCycleCount = await page.evaluate(() => window.__healthRequestCount);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator('[role="status"][aria-label="Connecting to BikeTracking API…"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.__healthRequestCount)).toBeGreaterThan(firstCycleCount);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_retry_triggers_new_polling_cycle");
  await recorder.save(testInfo);
});
