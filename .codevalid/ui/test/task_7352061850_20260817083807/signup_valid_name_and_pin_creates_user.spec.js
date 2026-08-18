import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupSuccess,
} from "../../helpers/mock-api.js";

test("signup_valid_name_and_pin_creates_user", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "signup_valid_name_and_pin_creates_user",
    testTitle: "Valid name and PIN create new user and redirect to login",
  });

  await setupUnauthenticatedSession(page);
  await mockSignupSuccess(page, { prefillName: "Alex " });

  await recorder.step("Open signup page", async () => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("Fill valid name and PIN", async () => {
    await page.locator("#signup-name").fill("Alex ");
    await page.locator("#signup-pin").fill("1234");
    await expect(page.locator("#signup-name")).toHaveValue("Alex ");
    await expect(page.locator("#signup-pin")).toHaveValue("1234");
  });

  await recorder.step("Submit signup form", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("Verify redirect to login with prefilled name and no signup error", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alex ");
    await expect(page.getByText("Name is required.")).toHaveCount(0);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_valid_name_and_pin_creates_user");
  await recorder.save(testInfo);
});
