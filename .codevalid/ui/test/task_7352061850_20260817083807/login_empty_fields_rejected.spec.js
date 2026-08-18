import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("login_empty_fields_rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_empty_fields_rejected",
    testTitle: "Login with empty name or PIN is rejected with clear error",
  });

  let identifyCalled = false;
  await setupUnauthenticatedSession(page);
  await page.route("**/api/users/identify", async (route) => {
    identifyCalled = true;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Should not be called" }),
    });
  });

  await recorder.step("Open login page", async () => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
  });

  await recorder.step("Leave name empty and enter PIN", async () => {
    await page.locator("#login-pin").fill("1234");
  });

  await recorder.step("Submit invalid login form", async () => {
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("Verify validation error, retained PIN, and no API call", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Name is required.")).toBeVisible();
    await expect(page.locator("#login-pin")).toHaveValue("1234");
    expect(identifyCalled).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_empty_fields_rejected");
  await recorder.save(testInfo);
});
