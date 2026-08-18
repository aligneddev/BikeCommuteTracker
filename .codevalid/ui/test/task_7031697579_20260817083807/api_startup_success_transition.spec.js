import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("App transitions to login page when API becomes healthy", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_success_transition",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("mock a successful health response", async () => {
    await page.route("**/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });
  });

  await recorder.step("launch the application", async () => {
    await page.goto("/");
  });

  await recorder.step("verify startup guard resolves to login page", async () => {
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commute Bike Tracker" })).toBeVisible();
    await expect(page.getByText("Connecting…")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_success_transition");
  await recorder.save(testInfo);
});
