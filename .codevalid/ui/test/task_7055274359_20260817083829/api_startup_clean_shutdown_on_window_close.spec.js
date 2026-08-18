import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthAlwaysFails,
  attachHealthRequestCounter,
} from "../../helpers/mock-api.js";

test("Polling and intervals are cleaned up on window close or app quit", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_clean_shutdown_on_window_close",
    testTitle: testInfo.title,
  });

  await recorder.step("Install mocked clock, failing health responses, and request counter");
  await page.clock.install();
  await setupUnauthenticatedSession(page);
  const counter = await attachHealthRequestCounter(page);
  await mockApiHealthAlwaysFails(page);

  await recorder.step("Open the application and confirm polling is active");
  await page.goto("/");
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(1200);
  const countBeforeUnload = counter.count();
  expect(countBeforeUnload).toBeGreaterThan(0);

  await recorder.step("Simulate application shutdown by unloading the page");
  await page.goto("about:blank");

  await recorder.step("Advance time and verify no further health requests occur after unmount");
  await page.clock.fastForward(5000);
  expect(counter.count()).toBe(countBeforeUnload);

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_clean_shutdown_on_window_close");
  await recorder.save(testInfo);
});
