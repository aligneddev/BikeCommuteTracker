import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession, mockDashboardLoginAndLanding } from "../../helpers/mock-api.js";

test("dashboard_lands_on_authenticated_user", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("dashboard_lands_on_authenticated_user", testInfo.title);

  await recorder.step("Clear any existing auth session", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("Mock successful login and dashboard landing data", async () => {
    await mockDashboardLoginAndLanding(page);
  });

  await recorder.step("Navigate to application root", async () => {
    await page.goto("/");
  });

  await recorder.step("Login with valid credentials", async () => {
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.getByLabel("Name").fill("John Doe");
    await page.getByLabel("PIN").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("Verify redirect and dashboard render", async () => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Current Month")).toBeVisible();
    await expect(page.getByText("Year to Date")).toBeVisible();
    await expect(page.getByText("All Time")).toBeVisible();
    await expect(page.getByText("Mileage rate savings $39.00")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:dashboard_lands_on_authenticated_user");
  await recorder.save(testInfo);
});
