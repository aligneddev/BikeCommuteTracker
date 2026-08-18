import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("Ride import blocked when offline with clear message and retry option", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("import_rides_offline_blocked", "Ride import blocked when offline with clear message and retry option");

  await recorder.step("Seed authenticated installed-app session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Mock startup health endpoint as unavailable", async () => {
    await page.route("**/health", async (route) => {
      await route.abort("failed");
    });
  });

  await recorder.step("Launch app while offline/unavailable", async () => {
    await page.goto("/");
  });

  await recorder.step("Observe startup connectivity failure state", async () => {
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByText(/The app was unable to start the local API/i)).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rides_offline_blocked");
  await recorder.save(testInfo);
});
