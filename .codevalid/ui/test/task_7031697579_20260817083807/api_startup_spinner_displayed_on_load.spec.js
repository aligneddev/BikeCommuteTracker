import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Connecting spinner is displayed during API startup", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_spinner_displayed_on_load",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("mock a hanging health endpoint before launch", async () => {
    await page.route("**/health", async () => {
      await new Promise(() => {});
    });
  });

  await recorder.step("launch the application", async () => {
    await page.goto("/");
  });

  await recorder.step("verify connecting spinner is visible and app pages are hidden", async () => {
    await expect(page.locator('[role="status"][aria-label="Connecting to BikeTracking API…"]')).toBeVisible();
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Log in" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Commute Bike Tracker" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_spinner_displayed_on_load");
  await recorder.save(testInfo);
});
