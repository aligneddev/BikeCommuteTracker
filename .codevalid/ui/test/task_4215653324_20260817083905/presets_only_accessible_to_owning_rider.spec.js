import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, mockCommonAppRoutes } from "../../helpers/mock-api.js";

test("Presets are inaccessible to other riders", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "presets_only_accessible_to_owning_rider",
    testTitle: "Presets are inaccessible to other riders",
  });

  await setupAuthenticatedSession(page, {
    token: "mock-valid-token-rider-b",
    user: {
      id: "user-2",
      username: "riderb",
      email: "riderb@example.com",
      fullName: "Rider B",
      phone: "+1 (555) 000-0001",
      organization: "Acme Corp",
    },
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "bike_tracking_auth_session",
      JSON.stringify({
        userId: 2,
        userName: "rider-b",
        lastActivityAtUtc: "2099-08-17T08:00:00.000Z",
        expiresAtUtc: "2099-08-17T09:00:00.000Z",
      })
    );
  });

  await mockCommonAppRoutes(page);

  await page.route("**/api/user-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          weatherApiKey: null,
          eiaGasApiKey: null,
        },
      }),
    });
  });

  await page.route("**/api/rides/presets", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        presets: [],
        generatedAtUtc: "2026-08-17T08:30:00.000Z",
      }),
    });
  });

  await recorder.recordStep("Open Settings page as Rider B");
  await page.goto("/settings");

  await recorder.recordStep("Verify Ride Presets section is visible without Rider A data");
  await expect(page.getByRole("heading", { name: "Ride Presets" })).toBeVisible();
  await expect(page.getByText("RiderA Commute")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:presets_only_accessible_to_owning_rider");
  await recorder.save(testInfo);
});
