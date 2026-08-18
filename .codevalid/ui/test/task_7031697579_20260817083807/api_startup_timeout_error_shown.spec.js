import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Error UI is shown when API fails to start within 10 seconds", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_timeout_error_shown",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("mock repeated unready health responses", async () => {
    await page.route("**/health", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Service unavailable" }),
      });
    });
  });

  await recorder.step("launch the application", async () => {
    await page.goto("/");
  });

  await recorder.step("verify timeout error UI appears after startup polling window", async () => {
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByText(/The app was unable to start the local API after 10 seconds\./)).toBeVisible();
    await expect(page.getByText("Connecting…")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Log in" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_timeout_error_shown");
  await recorder.save(testInfo);
});
