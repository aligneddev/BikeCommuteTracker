import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("No duplicate health requests are sent during active polling", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "no_duplicate_polling_requests",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare concurrency instrumentation", async () => {
    await setupUnauthenticatedSession(page);
    await page.addInitScript(() => {
      window.__healthConcurrency = { current: 0, max: 0, total: 0 };
    });
  });

  await recorder.step("mock slow health failures and track concurrent requests", async () => {
    await page.route("**/health", async (route) => {
      await page.evaluate(() => {
        window.__healthConcurrency.current += 1;
        window.__healthConcurrency.total += 1;
        if (window.__healthConcurrency.current > window.__healthConcurrency.max) {
          window.__healthConcurrency.max = window.__healthConcurrency.current;
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 800));

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Still starting" }),
      });

      await page.evaluate(() => {
        window.__healthConcurrency.current -= 1;
      });
    });
  });

  await recorder.step("launch and allow several polling iterations", async () => {
    await page.goto("/");
    await expect(page.getByText("Connecting…")).toBeVisible();
    await page.waitForTimeout(3500);
  });

  await recorder.step("verify only one health request was in flight at any time", async () => {
    const stats = await page.evaluate(() => window.__healthConcurrency);
    expect(stats.total).toBeGreaterThan(1);
    expect(stats.max).toBe(1);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:no_duplicate_polling_requests");
  await recorder.save(testInfo);
});
