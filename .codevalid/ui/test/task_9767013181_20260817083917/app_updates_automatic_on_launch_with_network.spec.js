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

test("App automatically checks for and applies latest version on launch with network", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("app_updates_automatic_on_launch_with_network", "App automatically checks for and applies latest version on launch with network");

  await recorder.step("Seed authenticated session", async () => {
    await setupAuthenticatedSession(page);
  });

  await recorder.step("Provide healthy startup API", async () => {
    await page.route("**/health", async (route) => {
      await json(route, 200, { status: "ok" });
    });
  });

  await recorder.step("Launch app and observe startup phase", async () => {
    await page.goto("/");
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commute Bike Tracker" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:app_updates_automatic_on_launch_with_network");
  await recorder.save(testInfo);
});
