import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockProtectedSettingsUnauthorized,
} from "../../helpers/mock-api.js";

test("api_keys_inaccessible_without_authentication", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_keys_inaccessible_without_authentication",
    testTitle: "API keys are inaccessible to unauthenticated users",
  });

  await setupUnauthenticatedSession(page);
  await mockProtectedSettingsUnauthorized(page);

  await recorder.step("Call protected settings endpoint without auth", async () => {
    await page.goto("/login");
    const response = await page.evaluate(async () => {
      const result = await fetch("/api/users/me/settings");
      return {
        status: result.status,
        body: await result.json(),
      };
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  await recorder.step("Verify unauthenticated user does not see settings screen", async () => {
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:api_keys_inaccessible_without_authentication");
  await recorder.save(testInfo);
});
