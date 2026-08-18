import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Login page provides clear link to SignupPage for new users", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_navigation_to_signup", "Login page provides clear link to SignupPage for new users");

  await recorder.step("open login page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await recorder.step("click create account link", async () => {
    await page.getByRole("link", { name: "Create an account" }).click();
  });

  await recorder.step("verify signup page loads cleanly", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.locator("#signup-name")).toHaveValue("");
    await expect(page.locator("#signup-pin")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_navigation_to_signup");
  await recorder.save(testInfo);
});
