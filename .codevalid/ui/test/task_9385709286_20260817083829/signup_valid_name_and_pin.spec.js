import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupSuccessFlow,
} from "../../helpers/mock-api.js";

test("signup_valid_name_and_pin", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_valid_name_and_pin", "User successfully signs up with valid name and PIN");

  await recorder.step("clear session and register successful signup mocks", async () => {
    await setupUnauthenticatedSession(page);
    await mockSignupSuccessFlow(page, {
      expectedName: "JohnDoe",
      expectedPin: "1234",
      createdUser: {
        userId: 101,
        userName: "JohnDoe",
        normalizedName: "johndoe",
        isActive: true,
        createdAtUtc: "2026-08-17T08:38:29.000Z",
        updatedAtUtc: "2026-08-17T08:38:29.000Z",
        credential: {
          algorithm: "PBKDF2",
          hash: "pbkdf2$mock-salted-hash",
          salt: "mock-salt",
          pinStoredAsPlaintext: false,
        },
        outboxEvent: {
          type: "user-registered",
          userId: 101,
          userName: "JohnDoe",
          registeredAtUtc: "2026-08-17T08:38:29.000Z",
          containsPlaintextPin: false,
        },
      },
    });
  });

  await recorder.step("open signup page", async () => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Commute Bike Tracker" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("enter valid name and pin", async () => {
    await page.locator("#signup-name").fill("JohnDoe");
    await page.locator("#signup-pin").fill("1234");
  });

  await recorder.step("submit signup", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify redirect to login and no validation error", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByText("Name is required.")).toHaveCount(0);
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toHaveCount(0);
  });

  await recorder.step("verify mocked backend contract details", async () => {
    const signupState = await page.evaluate(() => window.__codevalidMockState?.signup);
    expect(signupState.requestCount).toBe(1);
    expect(signupState.lastRequest.name).toBe("JohnDoe");
    expect(signupState.lastRequest.pin).toBe("1234");
    expect(signupState.createdUser.userId).toBe(101);
    expect(signupState.createdUser.credential.algorithm).toBe("PBKDF2");
    expect(signupState.createdUser.credential.pinStoredAsPlaintext).toBe(false);
    expect(signupState.createdUser.outboxEvent.containsPlaintextPin).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_valid_name_and_pin");
  await recorder.save(testInfo);
});
