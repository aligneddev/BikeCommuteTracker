import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Polling stops when ApiStartupGuard unmounts", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "component_unmount_stops_polling",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare startup instrumentation", async () => {
    await setupUnauthenticatedSession(page);
    await page.addInitScript(() => {
      window.__healthCount = 0;
    });
  });

  await recorder.step("mock slow failing health responses", async () => {
    await page.route("**/health", async (route) => {
      await page.evaluate(() => {
        window.__healthCount += 1;
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Still starting" }),
      });
    });
  });

  await recorder.step("launch and confirm polling starts", async () => {
    await page.goto("/");
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.__healthCount)).toBeGreaterThan(0);
  });

  await recorder.step("remove the mounted app root and verify polling does not continue", async () => {
    const beforeUnmount = await page.evaluate(() => window.__healthCount);
    await page.evaluate(() => {
      const root = document.getElementById("root");
      if (root) {
        root.replaceChildren();
      }
    });
    await page.waitForTimeout(1500);
    const afterUnmount = await page.evaluate(() => window.__healthCount);
    expect(afterUnmount).toBe(beforeUnmount);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:component_unmount_stops_polling");
  await recorder.save(testInfo);
});
