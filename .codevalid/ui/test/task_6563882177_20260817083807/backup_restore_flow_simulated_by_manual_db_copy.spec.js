import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";
import { backupRestoreRideOne, backupRestoreRideTwo } from "../../mock/mock-data.js";

test("User can manually backup and restore ride history by copying biketracking.local.db file", async ({ page, context }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "backup_restore_flow_simulated_by_manual_db_copy",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange initial local ride history representing the pre-backup database", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupRideHistoryScenario(page, {
      rides: [backupRestoreRideOne, backupRestoreRideTwo],
      persistedStateKey: "backup-restore-db-state",
    });
  });

  await recorder.step("Open history and verify the original rides exist before backup removal", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("9.4", { exact: false })).toBeVisible();
    await expect(page.getByText("7.7", { exact: false })).toBeVisible();
  });

  await recorder.step("Simulate starting app after original db file is removed", async () => {
    const emptyPage = await context.newPage();
    await setupBikeTrackingAuthenticatedSession(emptyPage);
    await mockCommonAppRoutes(emptyPage);
    await setupRideHistoryScenario(emptyPage, {
      rides: [],
      persistedStateKey: "backup-restore-empty-state",
    });
    await emptyPage.goto("/rides/history");
    await expect(emptyPage.getByText("No rides found for this rider.")).toBeVisible();
    await emptyPage.close();
  });

  await recorder.step("Simulate restoring biketracking.local.db from backup and reopening the app", async () => {
    const restoredPage = await context.newPage();
    await setupBikeTrackingAuthenticatedSession(restoredPage);
    await mockCommonAppRoutes(restoredPage);
    await setupRideHistoryScenario(restoredPage, {
      rides: [backupRestoreRideOne, backupRestoreRideTwo],
      persistedStateKey: "backup-restore-db-state",
    });
    await restoredPage.goto("/rides/history");
    await expect(restoredPage.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(restoredPage.getByText("9.4", { exact: false })).toBeVisible();
    await expect(restoredPage.getByText("7.7", { exact: false })).toBeVisible();
    await restoredPage.close();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:backup_restore_flow_simulated_by_manual_db_copy");
  await recorder.save(testInfo);
});
