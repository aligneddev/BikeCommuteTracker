import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupUnauthenticatedSession } from "../../helpers/mock-api.js";

test("csv_import_unauthenticated_redirect", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_unauthenticated_redirect", "Unauthenticated user attempting to access /expenses/import is redirected to Login");

  await recorder.step("Clear any existing authenticated session.");
  await setupUnauthenticatedSession(page);
  await page.addInitScript(() => {
    window.sessionStorage.removeItem("bike_tracking_auth_session");
  });

  await recorder.step("Navigate directly to the protected import route.");
  await page.goto("/expenses/import");

  await recorder.step("Verify redirect to login and import UI remains hidden.");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Expenses" })).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_unauthenticated_redirect");
  await recorder.save(testInfo);
});
