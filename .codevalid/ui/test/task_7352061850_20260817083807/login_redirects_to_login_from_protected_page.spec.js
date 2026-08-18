import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Unauthenticated access to DashboardPage redirects to LoginPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_redirects_to_login_from_protected_page", "Unauthenticated access to DashboardPage redirects to LoginPage");

  await recorder.step("clear auth session", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("navigate directly to protected dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("verify redirect to login and no dashboard shell", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_redirects_to_login_from_protected_page");
  await recorder.save(testInfo);
});
