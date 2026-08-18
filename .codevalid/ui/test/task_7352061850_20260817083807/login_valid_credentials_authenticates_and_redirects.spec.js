import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSuccessfulIdentifyFlow,
  mockDashboardBootstrap,
} from "../../helpers/mock-api.js";

test("login_valid_credentials_authenticates_and_redirects", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_valid_credentials_authenticates_and_redirects",
    testTitle: "Valid name and PIN authenticate user and redirect to dashboard",
  });

  await setupUnauthenticatedSession(page);
  await mockSuccessfulIdentifyFlow(page, { userName: "alex" });
  await mockDashboardBootstrap(page);

  await recorder.step("Open login page", async () => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await recorder.step("Enter valid credentials", async () => {
    await page.locator("#login-name").fill("alex");
    await page.locator("#login-pin").fill("1234");
  });

  await recorder.step("Submit login form", async () => {
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("Verify redirect and authenticated dashboard state", async () => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await page.goto("/dashboard/advanced");
    await expect(page).toHaveURL(/\/dashboard\/advanced$/);
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_valid_credentials_authenticates_and_redirects");
  await recorder.save(testInfo);
});
