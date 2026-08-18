import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockDashboardApis,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";

test("pwa_unsupported_message_displayed_without_blocking", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "pwa_unsupported_message_displayed_without_blocking",
    testTitle: "System displays clear PWA unsupported message without blocking core functionality",
  });

  await recorder.step("Seed authenticated session and route mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockDashboardApis(page);
    await mockSettingsPageData(page);

    await page.addInitScript(() => {
      window.__CODEVALID_PWA_SNAPSHOT__ = {
        launchContext: { mode: "browser_tab", isOnline: true },
        installationState: {
          isInstallSupported: false,
          installPromptAvailable: false,
          status: "unavailable",
          reasonCode: "unsupported_browser",
        },
        updateState: { status: "idle" },
      };
    });

    await page.route("**/api/rides*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: [], totalMiles: 0, filteredMiles: 0 }),
      });
    });
  });

  await recorder.step("Patch PWA bootstrap snapshot functions for unsupported install environment", async () => {
    await page.addInitScript(() => {
      const snapshot = window.__CODEVALID_PWA_SNAPSHOT__;
      const maybePatch = () => {
        const candidate = window.BikeTrackingPwaBootstrap;
        if (!candidate) return false;
        candidate.getPwaSnapshot = () => snapshot;
        candidate.subscribePwaSnapshot = (listener) => {
          listener(snapshot);
          return () => {};
        };
        candidate.promptPwaInstall = async () => false;
        return true;
      };

      if (!maybePatch()) {
        Object.defineProperty(window, "BikeTrackingPwaBootstrap", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: {
            getPwaSnapshot: () => snapshot,
            subscribePwaSnapshot: (listener) => {
              listener(snapshot);
              return () => {};
            },
            promptPwaInstall: async () => false,
          },
        });
      }
    });
  });

  await recorder.step("Open Settings and verify unsupported install guidance", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
    await expect(page.getByText("Continue using browser mode.")).toBeVisible();
  });

  await recorder.step("Verify AppHeader remains functional while guidance is visible", async () => {
    await page.getByRole("link", { name: "Record Ride" }).click();
    await expect(page).toHaveURL(/\/rides\/record$/);
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:pwa_unsupported_message_displayed_without_blocking");
  await recorder.save(testInfo);
});
