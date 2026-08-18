import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Login fails with clear error when name field is empty", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_empty_name", "Login fails with clear error when name field is empty");

  await recorder.step("clear session and open login page", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await recorder.step("submit empty name with entered pin", async () => {
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify client validation prevents navigation and preserves values", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Name is required.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("");
    await expect(page.locator("#login-pin")).toHaveValue("1234");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_empty_name");
  await recorder.save(testInfo);
});
