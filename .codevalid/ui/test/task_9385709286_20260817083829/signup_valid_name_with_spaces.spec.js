import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupSuccessFlow,
} from "../../helpers/mock-api.js";

test("signup_valid_name_with_spaces", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_valid_name_with_spaces", "Signup succeeds with valid name containing internal or leading/trailing spaces");

  await recorder.step("clear session and register success mock for spaced name", async () => {
    await setupUnauthenticatedSession(page);
    await mockSignupSuccessFlow(page, {
      expectedName: "  Jane  Doe  ",
      expectedPin: "4321",
      createdUser: {
        userId: 202,
        userName: "  Jane  Doe  ",
        normalizedName: "janedoe",
        isActive: true,
        createdAtUtc: "2026-08-17T08:38:29.000Z",
        updatedAtUtc: "2026-08-17T08:38:29.000Z",
        credential: {
          algorithm: "PBKDF2",
          hash: "pbkdf2$mock-salted-hash-2",
          salt: "mock-salt-2",
          pinStoredAsPlaintext: false,
        },
        outboxEvent: {
          type: "user-registered",
          userId: 202,
          userName: "  Jane  Doe  ",
          registeredAtUtc: "2026-08-17T08:38:29.000Z",
          containsPlaintextPin: false,
        },
      },
    });
  });

  await recorder.step("open signup page and enter spaced name", async () => {
    await page.goto("/signup");
    await page.locator("#signup-name").fill("  Jane  Doe  ");
    await page.locator("#signup-pin").fill("4321");
  });

  await recorder.step("submit signup", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify redirect and persisted normalized backend intent", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    const signupState = await page.evaluate(() => window.__codevalidMockState?.signup);
    expect(signupState.requestCount).toBe(1);
    expect(signupState.lastRequest.name).toBe("  Jane  Doe  ");
    expect(signupState.createdUser.normalizedName).toBe("janedoe");
    expect(signupState.createdUser.credential.pinStoredAsPlaintext).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_valid_name_with_spaces");
  await recorder.save(testInfo);
});
