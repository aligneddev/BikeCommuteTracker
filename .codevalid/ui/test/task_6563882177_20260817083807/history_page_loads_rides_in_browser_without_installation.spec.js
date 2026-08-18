import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCommonAppRoutes,
  setupRideHistoryScenario,
} from "../../helpers/mock-api.js";
import { browserHistoryRideAlpha, browserHistoryRideBravo, browserHistoryRideCharlie } from "../../mock/mock-data.js";

test("Ride history loads correctly in-browser without PWA installation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "history_page_loads_rides_in_browser_without_installation",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated browser-mode session and ride history mocks", async () => {
    await setupBikeTrackingAuthenticatedSession(page);
    await mockCommonAppRoutes(page);
    await setupRideHistoryScenario(page, {
      rides: [browserHistoryRideAlpha, browserHistoryRideBravo, browserHistoryRideCharlie],
    });
  });

  await recorder.step("Open the local app history page in browser mode", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Total Miles (Visible)" })).toBeVisible();
  });

  await recorder.step("Verify all previously saved rides are visible without install prompts blocking usage", async () => {
    await expect(page.getByRole("table", { name: "Ride history table" })).toBeVisible();
    await expect(page.getByText("Mon 8/12/2024, 7:45 AM", { exact: false })).toBeVisible();
    await expect(page.getByText("Tue 8/13/2024, 6:20 PM", { exact: false })).toBeVisible();
    await expect(page.getByText("Wed 8/14/2024, 8:10 AM", { exact: false })).toBeVisible();
    await expect(page.getByText("12.4", { exact: false })).toBeVisible();
    await expect(page.getByText("8.1", { exact: false })).toBeVisible();
    await expect(page.getByText("15.6", { exact: false })).toBeVisible();
    await expect(page.getByText("68.2°", { exact: false })).toBeVisible();
    await expect(page.getByText("55.1°", { exact: false })).toBeVisible();
    await expect(page.getByText("72.4°", { exact: false })).toBeVisible();
    await expect(page.getByText("Downtown commute", { exact: false })).toBeHidden();
    await expect(page.getByText("No rides found for this rider.")).toHaveCount(0);
    await expect(page.getByText("Loading history...")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_page_loads_rides_in_browser_without_installation");
  await recorder.save(testInfo);
});
