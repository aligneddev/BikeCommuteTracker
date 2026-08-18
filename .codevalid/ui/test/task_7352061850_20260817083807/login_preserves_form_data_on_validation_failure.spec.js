import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockIdentifyFailure,
} from "../../helpers/mock-api.js";

test("Form input values are preserved after failed login submission", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_preserves_form_data_on_validation_failure", "Form input values are preserved after failed login submission");

  await recorder.step("open login page with failing identify mock", async () => {
    await setupUnauthenticatedSession(page);
    await mockIdentifyFailure(page, { status: 401, message: "Name or PIN is incorrect." });
    await page.goto("/login");
  });

  await recorder.step("submit wrong pin", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("4321");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify values remain for correction", async () => {
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page.locator("#login-name")).toHaveValue("Alice");
    await expect(page.locator("#login-pin")).toHaveValue("4321");
    await expect(page).toHaveURL(/\/login$/);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_preserves_form_data_on_validation_failure");
  await recorder.save(testInfo);
});
