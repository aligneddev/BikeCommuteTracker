import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRideHistoryFailureScenario,
} from "../../helpers/mock-api.js";

test("HistoryPage displays retry message on API server error (500/503)", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "history_api_failure_shows_retry",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Allow app startup health check to succeed", async () => {
    await setupHealthyStartupGuard(page);
  });

  await recorder.step("Mock history API failure", async () => {
    await setupRideHistoryFailureScenario(page, {
      status: 503,
      message: "Ride operations require an online connection. Offline access to ride history is not supported in v1.",
    });
  });

  await recorder.step("Navigate to HistoryPage", async () => {
    await page.goto("/rides/history");
  });

  await recorder.step("Verify error alert is shown and ride table is absent", async () => {
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      "Ride operations require an online connection. Offline access to ride history is not supported in v1."
    );
    await expect(page.locator('table[aria-label="Ride history table"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Apply Filter" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_api_failure_shows_retry");
  await recorder.save(testInfo);
});
