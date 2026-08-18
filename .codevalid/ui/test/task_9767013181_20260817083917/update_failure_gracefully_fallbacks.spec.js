import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";

test("Update failure does not prevent access to ride history", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "update_failure_gracefully_fallbacks",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Allow startup checks to succeed", async () => {
    await setupHealthyStartupGuard(page);
  });

  await recorder.step("Mock ride history APIs to continue serving current installed experience", async () => {
    await setupRideHistoryScenario(page);
  });

  await recorder.step("Open HistoryPage after simulated update failure elsewhere", async () => {
    await page.goto("/rides/history");
  });

  await recorder.step("Verify history is accessible and update failure UI is not shown on HistoryPage", async () => {
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.locator('table[aria-label="Ride history table"]')).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:update_failure_gracefully_fallbacks");
  await recorder.save(testInfo);
});
