import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockBrowserAccessibleApp,
} from "../../helpers/mock-api.js";

test("Application starts local web server upon local installation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "local_installation_starts_web_server",
    testTitle: testInfo.title,
  });

  await recorder.step("Prepare unauthenticated browser session and baseline API mocks.");
  await setupUnauthenticatedSession(page);
  await mockBrowserAccessibleApp(page);

  await recorder.step("Open the local application root URL.");
  await page.goto("/");

  await recorder.step("Verify the application responds and routes to the login experience.");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Commute Bike Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:local_installation_starts_web_server");
  await recorder.save(testInfo);
});
