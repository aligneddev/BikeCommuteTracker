import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockUnsupportedPwaEnvironment,
  mockCoreFeatureRoutes,
} from "../../helpers/mock-api.js";
import { setupRideImportScenario } from "../../helpers/ride-import-mock-api.js";

test("ImportRidesPage loads and renders fully in browser without PWA", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_rides_page_loads_in_browser",
    testTitle: "ImportRidesPage loads and renders fully in browser without PWA",
  });

  await recorder.step("Set authenticated browser session and unsupported PWA environment");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_browser" });
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "idle" });

  await recorder.step("Navigate to /rides/import");
  await page.goto("/rides/import");

  await recorder.step("Assert import page core UI renders in browser mode");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  await expect(page.locator('#csv-upload-input')).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Import" })).toBeVisible();
  await expect(page.getByText("Start an import to see progress and cancellation controls.")).toBeVisible();
  await expect(page.getByText("No file selected.")).toBeVisible();

  await recorder.step("Assert no PWA install prompt or unsupported install error is shown on this page");
  await expect(page.getByText(/PWA installation is not supported/i)).toHaveCount(0);
  await expect(page.getByText(/continue using the app in browser mode/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /install/i })).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:import_rides_page_loads_in_browser");
  await recorder.save(testInfo);
});
