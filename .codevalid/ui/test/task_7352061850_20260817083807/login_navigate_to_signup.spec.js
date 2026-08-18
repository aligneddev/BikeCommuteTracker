import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("login_navigate_to_signup", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_navigate_to_signup",
    testTitle: "Login page provides clear navigation to Signup page",
  });

  await setupUnauthenticatedSession(page);

  await recorder.step("Open login page", async () => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await recorder.step("Navigate to signup using visible link", async () => {
    await expect(page.getByText("New rider?")).toBeVisible();
    await page.getByRole("link", { name: "Create an account" }).click();
  });

  await recorder.step("Verify signup page route and heading", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_navigate_to_signup");
  await recorder.save(testInfo);
});
