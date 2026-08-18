import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthPending,
} from "../../helpers/mock-api.js";

test("Connecting spinner is displayed during API health polling", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_connecting_spinner_displayed",
    testTitle: testInfo.title,
  });

  await recorder.step("Set up unauthenticated session and pending health polling");
  await setupUnauthenticatedSession(page);
  await mockApiHealthPending(page);

  await recorder.step("Open the application");
  await page.goto("/");

  await recorder.step("Verify connecting spinner is visible and app content is withheld");
  await expect(page.getByText("Connecting…")).toBeVisible();
  await expect(page.getByRole("status", { name: "Connecting to BikeTracking API…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_connecting_spinner_displayed");
  await recorder.save(testInfo);
});
