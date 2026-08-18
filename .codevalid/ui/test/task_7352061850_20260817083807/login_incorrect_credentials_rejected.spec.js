import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockFailedIdentifyFlow,
} from "../../helpers/mock-api.js";

test("login_incorrect_credentials_rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_incorrect_credentials_rejected",
    testTitle: "Incorrect name or PIN denies login with generic error",
  });

  await setupUnauthenticatedSession(page);
  await mockFailedIdentifyFlow(page, { message: "Name or PIN is incorrect." });

  await recorder.step("Open login page", async () => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
  });

  await recorder.step("Enter invalid credentials", async () => {
    await page.locator("#login-name").fill("alex");
    await page.locator("#login-pin").fill("9999");
  });

  await recorder.step("Submit login form", async () => {
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("Verify generic auth error and preserved data", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("alex");
    await expect(page.locator("#login-pin")).toHaveValue("9999");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_incorrect_credentials_rejected");
  await recorder.save(testInfo);
});
