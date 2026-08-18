import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockIdentifyFailure,
} from "../../helpers/mock-api.js";

test("Login fails with general error when PIN does not match stored hash", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_incorrect_pin", "Login fails with general error when PIN does not match stored hash");

  await recorder.step("register failed identify route and open login page", async () => {
    await setupUnauthenticatedSession(page);
    await mockIdentifyFailure(page, { status: 401, message: "Name or PIN is incorrect." });
    await page.goto("/login");
  });

  await recorder.step("submit incorrect pin", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("4321");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify generic auth failure and preserved inputs", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alice");
    await expect(page.locator("#login-pin")).toHaveValue("4321");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_incorrect_pin");
  await recorder.save(testInfo);
});
