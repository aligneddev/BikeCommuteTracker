import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Login fails with clear error when PIN is less than 4 numeric digits", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_invalid_pin_format_too_short", "Login fails with clear error when PIN is less than 4 numeric digits");

  await recorder.step("open login page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
  });

  await recorder.step("submit short pin", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("123");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify client-side pin format validation", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alice");
    await expect(page.locator("#login-pin")).toHaveValue("123");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_invalid_pin_format_too_short");
  await recorder.save(testInfo);
});
