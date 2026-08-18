import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthAlwaysFails,
  attachHealthRequestCounter,
} from "../../helpers/mock-api.js";

test("Retry button re-initiates health polling from the beginning", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_retry_resets_polling",
    testTitle: testInfo.title,
  });

  await recorder.step("Install mocked clock and failing health responses with request counter");
  await page.clock.install();
  await setupUnauthenticatedSession(page);
  const counter = await attachHealthRequestCounter(page);
  await mockApiHealthAlwaysFails(page);

  await recorder.step("Open the application and let first polling window time out");
  await page.goto("/");
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(10050);
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
  const firstCycleCount = counter.count();

  await recorder.step("Click Retry and verify connecting state resumes immediately");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Connecting…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  await recorder.step("Advance another full polling window and verify a new cycle occurred");
  await page.clock.fastForward(10050);
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
  expect(counter.count()).toBeGreaterThan(firstCycleCount);

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_retry_resets_polling");
  await recorder.save(testInfo);
});
