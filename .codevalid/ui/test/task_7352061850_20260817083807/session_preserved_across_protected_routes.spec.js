import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  mockDashboardBootstrap,
} from "../../helpers/mock-api.js";

test("session_preserved_across_protected_routes", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "session_preserved_across_protected_routes",
    testTitle: "Authenticated session persists across protected page navigations",
  });

  await setupAuthenticatedSession(page, {
    userId: 1,
    userName: "alex",
    token: "mock-valid-token",
    user: { id: "user-1", fullName: "alex" },
  });
  await mockDashboardBootstrap(page);

  await recorder.step("Open protected dashboard with authenticated session", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
  });

  await recorder.step("Navigate to advanced dashboard and remain authenticated", async () => {
    await page.goto("/dashboard/advanced");
    await expect(page).toHaveURL(/\/dashboard\/advanced$/);
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:session_preserved_across_protected_routes");
  await recorder.save(testInfo);
});
