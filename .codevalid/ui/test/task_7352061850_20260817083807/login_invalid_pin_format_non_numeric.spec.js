import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Login fails with clear error when PIN contains non-numeric characters", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_invalid_pin_format_non_numeric", "Login fails with clear error when PIN contains non-numeric characters");

  await recorder.step("open login page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
  });

  await recorder.step("submit non-numeric pin", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("abc123");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify pin format validation and preserved values", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alice");
    await expect(page.locator("#login-pin")).toHaveValue("abc123");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_invalid_pin_format_non_numeric");
  await recorder.save(testInfo);
});
