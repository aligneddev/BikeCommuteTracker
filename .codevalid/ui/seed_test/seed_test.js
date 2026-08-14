/**
 * Seed test — proves the BikeTracking frontend starts, is reachable,
 * and the login page renders a visible heading.
 *
 * Project: codevalid-sample-test
 * Stack:   React 19 + Vite 8, name+PIN form auth (no SSO/Cognito)
 *
 * The mock API server (mock/mock-api-server.js) handles:
 *   GET /health  → 200  (satisfies ApiStartupGuard)
 *   POST /api/users/identify → 200 (login)
 *   …and other endpoints the app polls after login.
 */

import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../helpers/execution-recorder.js";

test.describe("Seed — app reachability", () => {
  test("login page loads and shows the app heading", async ({ page }, testInfo) => {
    const recorder = new ExecutionRecorder({
      testId: "seed-001",
      testTitle: "login page loads and shows the app heading",
    });

    await recorder.step("navigate to app root", async () => {
      await page.goto("/");
    });

    // The app redirects "/" → "/login". ApiStartupGuard polls /health on the
    // mock API server (port 5436). Once it gets 200, children render.
    await recorder.step("assert login heading is visible", async () => {
      await expect(
        page.getByRole("heading", { name: /commute bike tracker/i })
      ).toBeVisible({ timeout: 20000 });
    });

    await recorder.step("assert login form fields are present", async () => {
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/pin/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    });

    await recorder.save(testInfo);
  });

  test("title tag is set correctly", async ({ page }, testInfo) => {
    const recorder = new ExecutionRecorder({
      testId: "seed-002",
      testTitle: "title tag is set correctly",
    });

    await recorder.step("navigate to app root", async () => {
      await page.goto("/");
    });

    await recorder.step("assert document title", async () => {
      await expect(page).toHaveTitle(/BikeTracking/i, { timeout: 15000 });
    });

    await recorder.save(testInfo);
  });
});
