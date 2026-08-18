import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupSettingsPageScenario,
} from "../../helpers/mock-api.js";

test("Installation failure is clearly communicated with retry or browser mode options", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "install_failure_user_informs_and_offers_alternative",
    testTitle: testInfo.title,
  });

  await recorder.step("prepare authenticated settings page", async () => {
    await setupAuthenticatedSession(page);
    await setupSettingsPageScenario(page);
  });

  await recorder.step("open settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  });

  await recorder.step("assert installation failure alternatives", async () => {
    await expect(
      page.getByText("Installation failed. You can still use the app in your browser.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry Installation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue in Browser" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:install_failure_user_informs_and_offers_alternative");
  await recorder.save(testInfo);
});
