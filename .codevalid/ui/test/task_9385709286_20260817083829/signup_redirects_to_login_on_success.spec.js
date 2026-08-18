import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupSuccessFlow,
} from "../../helpers/mock-api.js";

test("signup_redirects_to_login_on_success", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_redirects_to_login_on_success", "User is redirected to Login page after successful signup");

  await recorder.step("clear session and register successful signup mock", async () => {
    await setupUnauthenticatedSession(page);
    await mockSignupSuccessFlow(page, {
      expectedName: "Alice",
      expectedPin: "1111",
      createdUser: {
        userId: 303,
        userName: "Alice",
        normalizedName: "alice",
        isActive: true,
        createdAtUtc: "2026-08-17T08:38:29.000Z",
        updatedAtUtc: "2026-08-17T08:38:29.000Z",
        credential: {
          algorithm: "PBKDF2",
          hash: "pbkdf2$mock-salted-hash-3",
          salt: "mock-salt-3",
          pinStoredAsPlaintext: false,
        },
        outboxEvent: {
          type: "user-registered",
          userId: 303,
          userName: "Alice",
          registeredAtUtc: "2026-08-17T08:38:29.000Z",
          containsPlaintextPin: false,
        },
      },
    });
  });

  await recorder.step("complete signup", async () => {
    await page.goto("/signup");
    await page.locator("#signup-name").fill("Alice");
    await page.locator("#signup-pin").fill("1111");
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify redirected to login and not dashboard", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_redirects_to_login_on_success");
  await recorder.save(testInfo);
});
