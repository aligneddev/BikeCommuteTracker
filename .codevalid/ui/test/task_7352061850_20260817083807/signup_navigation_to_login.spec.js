import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("SignupPage provides clear link back to LoginPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_navigation_to_login", "SignupPage provides clear link back to LoginPage");

  await recorder.step("open signup page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("click log in link", async () => {
    await page.getByRole("link", { name: "Log in" }).click();
  });

  await recorder.step("verify login page is shown", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("");
    await expect(page.locator("#login-pin")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_navigation_to_login");
  await recorder.save(testInfo);
});
