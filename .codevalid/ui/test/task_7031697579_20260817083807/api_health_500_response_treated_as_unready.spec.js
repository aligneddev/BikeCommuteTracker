import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("HTTP 500 or non-200 health response triggers error state", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_health_500_response_treated_as_unready",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("mock a 500 health response", async () => {
    await page.route("**/health", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      });
    });
  });

  await recorder.step("launch the application", async () => {
    await page.goto("/");
  });

  await recorder.step("verify app remains in startup state until timeout error", async () => {
    await expect(page.getByText("Connecting…")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Log in" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_health_500_response_treated_as_unready");
  await recorder.save(testInfo);
});
