import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("signup_empty_name_rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "signup_empty_name_rejected",
    testTitle: "Signup with empty name is rejected with clear error",
  });

  let signupCalled = false;
  await setupUnauthenticatedSession(page);
  await page.route("**/api/users/signup", async (route) => {
    signupCalled = true;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Should not be called" }),
    });
  });

  await recorder.step("Open signup page", async () => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup$/);
  });

  await recorder.step("Leave name empty and enter PIN", async () => {
    await page.locator("#signup-pin").fill("1234");
    await expect(page.locator("#signup-pin")).toHaveValue("1234");
  });

  await recorder.step("Submit invalid signup form", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("Verify validation error and no navigation", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("Name is required.")).toBeVisible();
    await expect(page.locator("#signup-pin")).toHaveValue("1234");
    expect(signupCalled).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_empty_name_rejected");
  await recorder.save(testInfo);
});
