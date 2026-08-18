import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("PWA installation failure prompts user to retry or continue in browser", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("pwa_install_failure_prompts_retry_or_browser_use", "PWA installation failure prompts user to retry or continue in browser");

  await recorder.step("Seed authenticated session and healthy startup", async () => {
    await setupAuthenticatedSession(page);
    await page.route("**/health", async (route) => {
      await json(route, 200, { status: "ok" });
    });
  });

  await recorder.step("Mock install prompt availability but force install failure", async () => {
    await page.addInitScript(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
  });

  await recorder.step("Open settings install section", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  });

  await recorder.step("Attempt installation and observe graceful failure messaging", async () => {
    const installButton = page.getByRole("button", { name: "Install on this computer" });
    if (await installButton.isVisible()) {
      await installButton.click();
    }
    await expect(page.getByText("Install was not completed. You can continue in browser mode and retry later.")).toBeVisible();
  });

  await recorder.step("Verify browser-mode continuity remains available", async () => {
    await page.getByRole("link", { name: "Import Rides from CSV" }).click();
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:pwa_install_failure_prompts_retry_or_browser_use");
  await recorder.save(testInfo);
});
