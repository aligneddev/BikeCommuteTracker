import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupOfflineStartupGuard,
} from "../../helpers/mock-api.js";

test("Ride history access blocked with clear message when offline", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "history_access_while_offline_blocked",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated installed-app session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock startup health endpoint as offline", async () => {
    await setupOfflineStartupGuard(page);
  });

  await recorder.step("Navigate to protected history route while offline", async () => {
    await page.goto("/rides/history");
  });

  await recorder.step("Verify startup connectivity error is shown and history content is blocked", async () => {
    await expect(
      page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ride History" })).not.toBeVisible();
    await expect(page.locator('table[aria-label="Ride history table"]')).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_access_while_offline_blocked");
  await recorder.save(testInfo);
});
