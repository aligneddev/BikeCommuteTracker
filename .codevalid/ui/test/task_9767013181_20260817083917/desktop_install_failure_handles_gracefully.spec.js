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

test("Desktop installer failure prompts retry or browser use", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("desktop_install_failure_handles_gracefully", "Desktop installer failure prompts retry or browser use");

  await recorder.step("Seed authenticated session and healthy startup", async () => {
    await setupAuthenticatedSession(page);
    await page.route("**/health", async (route) => {
      await json(route, 200, { status: "ok" });
    });
  });

  await recorder.step("Open install settings UI", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  });

  await recorder.step("Observe graceful unsupported or failed install state", async () => {
    const installButton = page.getByRole("button", { name: "Install on this computer" });
    if (await installButton.isVisible()) {
      await installButton.click();
      await expect(page.getByText("Install was not completed. You can continue in browser mode and retry later.")).toBeVisible();
    } else {
      await expect(page.getByText(/Installation is not available/i)).toBeVisible();
    }
  });

  await recorder.step("Continue using browser application flows", async () => {
    await page.getByRole("link", { name: "Import Rides from CSV" }).click();
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:desktop_install_failure_handles_gracefully");
  await recorder.save(testInfo);
});
