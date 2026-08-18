import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthAlwaysFails,
} from "../../helpers/mock-api.js";

test("User can invoke multiple retry cycles until API becomes ready", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_multiple_retry_cycles",
    testTitle: testInfo.title,
  });

  await recorder.step("Install mocked clock and permanent health failure scenario");
  await page.clock.install();
  await setupUnauthenticatedSession(page);
  await mockApiHealthAlwaysFails(page);

  await recorder.step("Open the application and reach the initial timeout error state");
  await page.goto("/");
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(10050);
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();

  await recorder.step("Perform first retry and confirm timer resets");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByText("Connecting…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  await recorder.step("Perform second retry before the first retry window expires");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByText("Connecting…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  await recorder.step("Perform third retry and verify error returns only after the final 10-second window");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(9000);
  await expect(page.getByText("Connecting…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();
  await page.clock.fastForward(1100);
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_multiple_retry_cycles");
  await recorder.save(testInfo);
});
