import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Network connection refused triggers error state", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_health_connection_refused_treated_as_unready",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare unauthenticated startup state", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("mock network failure for health endpoint", async () => {
    await page.route("**/health", async (route) => {
      await route.abort("failed");
    });
  });

  await recorder.step("launch the application", async () => {
    await page.goto("/");
  });

  await recorder.step("verify startup error appears without raw network error text", async () => {
    await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByText("ERR_CONNECTION_REFUSED")).toHaveCount(0);
    await expect(page.getByText("ECONNREFUSED")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Log in" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_health_connection_refused_treated_as_unready");
  await recorder.save(testInfo);
});
