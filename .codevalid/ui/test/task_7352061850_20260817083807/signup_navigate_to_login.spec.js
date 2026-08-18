import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("signup_navigate_to_login", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "signup_navigate_to_login",
    testTitle: "Signup page provides clear navigation to Login page",
  });

  await setupUnauthenticatedSession(page);

  await recorder.step("Open signup page", async () => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("Navigate to login using visible link", async () => {
    await expect(page.getByText("Already have an account?")).toBeVisible();
    await page.getByRole("link", { name: "Log in" }).click();
  });

  await recorder.step("Verify login page route and heading", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_navigate_to_login");
  await recorder.save(testInfo);
});
