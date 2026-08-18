import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupSuccessFlow,
  mockDashboardSummaryRoutes,
} from "../../helpers/mock-api.js";

test("signup_no_session_established", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_no_session_established", "No authenticated session is established after signup");

  await recorder.step("clear session and register signup plus dashboard mocks", async () => {
    await setupUnauthenticatedSession(page);
    await mockSignupSuccessFlow(page, {
      expectedName: "FreshRider",
      expectedPin: "1234",
      createdUser: {
        userId: 404,
        userName: "FreshRider",
        normalizedName: "freshrider",
        isActive: true,
        createdAtUtc: "2026-08-17T08:38:29.000Z",
        updatedAtUtc: "2026-08-17T08:38:29.000Z",
        credential: {
          algorithm: "PBKDF2",
          hash: "pbkdf2$mock-salted-hash-4",
          salt: "mock-salt-4",
          pinStoredAsPlaintext: false,
        },
        outboxEvent: {
          type: "user-registered",
          userId: 404,
          userName: "FreshRider",
          registeredAtUtc: "2026-08-17T08:38:29.000Z",
          containsPlaintextPin: false,
        },
      },
    });
    await mockDashboardSummaryRoutes(page);
  });

  await recorder.step("sign up successfully", async () => {
    await page.goto("/signup");
    await page.locator("#signup-name").fill("FreshRider");
    await page.locator("#signup-pin").fill("1234");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  await recorder.step("navigate directly to protected dashboard", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("verify redirect back to login due to no auth session", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toHaveCount(0);
    const storedSession = await page.evaluate(() => window.sessionStorage.getItem("bike_tracking_auth_session"));
    expect(storedSession).toBeNull();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_no_session_established");
  await recorder.save(testInfo);
});
