import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("Year Stats Dashboard link is hidden for unauthenticated users", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder(
    "year_stats_link_hidden_for_unauthenticated_user",
    "Year Stats Dashboard link is hidden for unauthenticated users"
  );

  await recorder.step("Clear any authenticated session", async () => {
    await setupUnauthenticatedSession(page);
  });

  await recorder.step("Attempt to load an authenticated route", async () => {
    await page.goto("/dashboard");
  });

  await recorder.step("Assert redirect to login and absence of the protected Year Stats link", async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Year Stats" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:year_stats_link_hidden_for_unauthenticated_user");
  await recorder.save(testInfo);
});
