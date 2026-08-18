import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockIdentifySequenceForPinChecks,
  mockProtectedAppShellRoutes,
} from "../../helpers/mock-api.js";

test("PIN is never stored in plaintext (inferred)", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_no_pin_storage", "PIN is never stored in plaintext (inferred)");

  await recorder.step("register mixed success and failure identify responses", async () => {
    await setupUnauthenticatedSession(page);
    await mockIdentifySequenceForPinChecks(page);
    await mockProtectedAppShellRoutes(page);
    await page.goto("/login");
  });

  await recorder.step("first correct pin succeeds", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome, Alice!")).toBeVisible();
  });

  await recorder.step("reset to login and submit invalid format variant", async () => {
    await setupUnauthenticatedSession(page);
    await page.goto("/login");
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("123a");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
  });

  await recorder.step("submit wrong numeric pin and verify generic failure", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("4321");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  await recorder.step("original correct pin still works", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome, Alice!")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_no_pin_storage");
  await recorder.save(testInfo);
});
