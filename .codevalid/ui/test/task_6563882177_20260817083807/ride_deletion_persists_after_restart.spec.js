import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";
import { deletionPersistenceRideOne, deletionPersistenceRideTwo } from "../../mock/mock-data.js";

test("Deleted rides do not reappear after application restart", async ({ page, context }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_deletion_persists_after_restart",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and two persisted rides", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupRideHistoryScenario(page, {
      rides: [deletionPersistenceRideOne, deletionPersistenceRideTwo],
      persistedStateKey: "ride-delete-persistence",
    });
  });

  await recorder.step("Delete one ride from history", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("River trail morning", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByRole("heading", { name: "Delete Ride" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("10.2", { exact: false })).toHaveCount(0);
    await expect(page.getByText("6.8", { exact: false })).toBeVisible();
  });

  await recorder.step("Simulate restart and verify deleted ride does not return", async () => {
    const reopened = await context.newPage();
    await setupBikeTrackingAuthenticatedSession(reopened);
    await mockCommonAppRoutes(reopened);
    await setupRideHistoryScenario(reopened, {
      rides: [deletionPersistenceRideOne, deletionPersistenceRideTwo],
      persistedStateKey: "ride-delete-persistence",
    });
    await reopened.goto("/rides/history");
    await expect(reopened.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(reopened.getByText("10.2", { exact: false })).toHaveCount(0);
    await expect(reopened.getByText("6.8", { exact: false })).toBeVisible();
    await reopened.close();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_deletion_persists_after_restart");
  await recorder.save(testInfo);
});
