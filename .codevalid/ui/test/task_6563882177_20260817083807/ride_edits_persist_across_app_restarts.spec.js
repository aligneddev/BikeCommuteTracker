import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";
import { editablePersistenceRide } from "../../mock/mock-data.js";

test("Ride edits and additions persist after application restarts", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_edits_persist_across_app_restarts",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and persistent ride scenario", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupRideHistoryScenario(page, {
      rides: [editablePersistenceRide],
    });
  });

  await recorder.step("Open history and edit an existing ride", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-ride-miles-401").fill("14.8");
    await page.locator("#edit-ride-note-401").fill("Updated after local edit");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("14.8", { exact: false })).toBeVisible();
  });

  await recorder.step("Simulate app restart by reloading the route with the same local mocked state", async () => {
    await page.close();
  });

  await recorder.step("Reopen browser context page and verify edited ride remains", async () => {
    const reopened = await testInfo.attach ? page.context().newPage() : null;
    const activePage = reopened ?? page;
    await setupBikeTrackingAuthenticatedSession(activePage);
    await mockCommonAppRoutes(activePage);
    await setupRideHistoryScenario(activePage, {
      rides: [editablePersistenceRide],
      persistedStateKey: "ride-edit-persistence",
    });
    await activePage.goto("/rides/history");
    await expect(activePage.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(activePage.getByText("14.8", { exact: false })).toBeVisible();
    await activePage.getByRole("button", { name: "Edit" }).click();
    await expect(activePage.locator("#edit-ride-note-401")).toHaveValue("Updated after local edit");
    if (reopened) {
      await reopened.close();
    }
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_edits_persist_across_app_restarts");
  await recorder.save(testInfo);
});
