import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("expense_entry_auth_redirect", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_auth_redirect",
    testTitle: "Unauthenticated user redirected from expense entry page",
  });

  await recorder.step("seed unauthenticated session and startup routes", async () => {
    await setupUnauthenticatedSession(page);
    await mockCommonAppRoutes(page);
  });

  await recorder.step("navigate to protected expense entry route", async () => {
    await page.goto("/expenses/entry");
  });

  await recorder.step("assert redirect to login and no expense entry heading", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record Expense" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_auth_redirect");
  await recorder.save(testInfo);
});
