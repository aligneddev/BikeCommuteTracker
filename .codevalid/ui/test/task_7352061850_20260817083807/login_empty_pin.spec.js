import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Login fails with clear error when PIN field is empty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_empty_pin", "Login fails with clear error when PIN field is empty");

  await recorder.step("clear session and open login page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
  });

  await recorder.step("submit empty pin with entered name", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify pin validation and preserved form data", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alice");
    await expect(page.locator("#login-pin")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_empty_pin");
  await recorder.save(testInfo);
});
