import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("signup_invalid_pin_format_rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "signup_invalid_pin_format_rejected",
    testTitle: "Signup with invalid PIN format (e.g., letters) is rejected",
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

  await recorder.step("Enter name and invalid PIN", async () => {
    await page.locator("#signup-name").fill("alex");
    await page.locator("#signup-pin").fill("abc");
  });

  await recorder.step("Submit invalid signup form", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("Verify PIN validation message and retained values", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
    await expect(page.locator("#signup-name")).toHaveValue("alex");
    await expect(page.locator("#signup-pin")).toHaveValue("abc");
    expect(signupCalled).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_invalid_pin_format_rejected");
  await recorder.save(testInfo);
});
