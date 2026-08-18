import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";

test("Export Expenses button is visible and labeled clearly", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_expenses_button_visible",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and settings mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
  });

  await recorder.step("Load the Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
  });

  await recorder.step("Locate the Export Expenses control", async () => {
    await expect(page.getByRole("button", { name: "Export Expenses" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Expenses" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_expenses_button_visible");
  await recorder.save(testInfo);
});
