import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("access_protected_page_unauthenticated_redirects", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "access_protected_page_unauthenticated_redirects",
    testTitle: "Unauthenticated access to dashboard redirects to login",
  });

  await setupUnauthenticatedSession(page);

  await recorder.step("Attempt direct navigation to protected dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Verify redirect to login", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:access_protected_page_unauthenticated_redirects");
  await recorder.save(testInfo);
});
