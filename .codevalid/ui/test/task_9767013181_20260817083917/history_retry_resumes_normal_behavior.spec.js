import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecoveringStartupGuard,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";

test("Retry action resumes normal ride history behavior after network restoration", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "history_retry_resumes_normal_behavior",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock startup guard to fail first and succeed after retry", async () => {
    await setupRecoveringStartupGuard(page);
  });

  await recorder.step("Mock successful ride history APIs", async () => {
    await setupRideHistoryScenario(page);
  });

  await recorder.step("Open history route", async () => {
    await page.goto("/rides/history");
  });

  await recorder.step("Wait for startup guard failure state", async () => {
    await expect(
      page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })
    ).toBeVisible();
  });

  await recorder.step("Retry connectivity and wait for history page to load", async () => {
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Total Miles (Visible)" })).toBeVisible();
  });

  await recorder.step("Verify ride table and edit delete actions are available after recovery", async () => {
    await expect(page.locator('table[aria-label="Ride history table"]')).toBeVisible();
    await expect(page.getByText("Morning Commute")).toBeVisible();
    await expect(page.getByText("Evening Return")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_retry_resumes_normal_behavior");
  await recorder.save(testInfo);
});
