import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRideHistoryScenario,
  setupRideHistoryFailureScenario,
} from "../../helpers/mock-api.js";

test("Previously viewed or edited ride data is preserved across connectivity interruptions", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "cache_preservation_on_retry",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Allow startup guard to pass", async () => {
    await setupHealthyStartupGuard(page);
  });

  await recorder.step("Mock initial successful ride history load", async () => {
    await setupRideHistoryScenario(page);
  });

  await recorder.step("Navigate to HistoryPage and confirm initial rides render", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("Morning Commute")).toBeVisible();
  });

  await recorder.step("Simulate connectivity interruption for subsequent history reloads", async () => {
    await page.unroute("**/api/rides/history**");
    await setupRideHistoryFailureScenario(page, {
      status: 503,
      message: "Ride operations require an online connection. Offline access to ride history is not supported in v1.",
    });
  });

  await recorder.step("Trigger a reload path using Apply Filter and confirm failure messaging", async () => {
    await page.getByRole("button", { name: "Apply Filter" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Ride operations require an online connection. Offline access to ride history is not supported in v1."
    );
    await expect(page.getByText("Morning Commute")).toBeVisible();
  });

  await recorder.step("Restore connectivity and retry the reload action", async () => {
    await page.unroute("**/api/rides/history**");
    await setupRideHistoryScenario(page);
    await page.getByRole("button", { name: "Apply Filter" }).click();
  });

  await recorder.step("Verify loaded entries are visible again and not corrupted", async () => {
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Morning Commute")).toBeVisible();
    await expect(page.getByText("Evening Return")).toBeVisible();
    await expect(page.locator('table[aria-label="Ride history table"]')).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:cache_preservation_on_retry");
  await recorder.save(testInfo);
});
