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

function buildHistoryResponse() {
  return {
    summaries: {
      thisMonth: { miles: 24.5, rideCount: 2, period: "thisMonth" },
      thisYear: { miles: 120.5, rideCount: 10, period: "thisYear" },
      allTime: { miles: 340.2, rideCount: 28, period: "allTime" },
    },
    filteredTotal: { miles: 24.5, rideCount: 2, period: "filtered" },
    rides: [
      {
        rideId: 101,
        rideDateTimeLocal: "2026-08-10T08:15:00",
        miles: 12.3,
        rideMinutes: 38,
        temperature: 68,
        gasPricePerGallon: 3.5999,
        windSpeedMph: 8,
        windDirectionDeg: 180,
        relativeHumidityPercent: 60,
        cloudCoverPercent: 20,
        precipitationType: "none",
        note: "Morning commute",
        difficulty: 3,
        primaryTravelDirection: "NE",
        windResistanceRating: 2,
      },
    ],
    page: 1,
    pageSize: 25,
    totalRows: 1,
  };
}

test("HistoryPage does not render or allow editing of rider-commute settings", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder(
    "history_page_does_not_expose_rider_settings",
    "HistoryPage does not render or allow editing of rider-commute settings"
  );

  await recorder.step("Seed authenticated rider session", async () => {
    await setupAuthenticatedSession(page, {
      userId: 1,
      userName: "history-rider",
      lastActivityAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  });

  await recorder.step("Mock history and supporting ride APIs used by HistoryPage", async () => {
    await page.route("**/api/rides/history**", async (route) =>
      json(route, 200, buildHistoryResponse())
    );

    await page.route("**/api/rides/gas-price**", async (route) =>
      json(route, 200, {
        date: "2026-08-10",
        pricePerGallon: 3.5999,
        isAvailable: true,
        dataSource: "EIA",
      })
    );

    await page.route("**/api/rides/weather**", async (route) =>
      json(route, 200, {
        rideDateTimeLocal: "2026-08-10T08:15:00",
        temperature: 68,
        windSpeedMph: 8,
        windDirectionDeg: 180,
        relativeHumidityPercent: 60,
        cloudCoverPercent: 20,
        precipitationType: "none",
        isAvailable: true,
      })
    );

    await page.route("**/api/rides/*", async (route) => {
      const method = route.request().method();
      if (method === "PUT") {
        return json(route, 200, {
          rideId: 101,
          newVersion: 2,
          message: "Ride updated successfully.",
        });
      }
      if (method === "DELETE") {
        return json(route, 200, {
          rideId: 101,
          deletedAt: new Date().toISOString(),
          message: "Ride deleted successfully.",
        });
      }
      return route.fallback();
    });
  });

  await recorder.step("Navigate to HistoryPage", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Total Miles (Visible)" })).toBeVisible();
    await expect(page.getByText("Morning commute")).toBeHidden();
  });

  await recorder.step("Verify ride metadata controls are available", async () => {
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByText("12.3")).toBeVisible();
    await expect(page.getByText("$3.5999")).toBeVisible();
    await expect(page.getByText("NE")).toBeVisible();
  });

  await recorder.step("Inspect the page for forbidden rider settings controls", async () => {
    await expect(page.getByText("average car mpg", { exact: false })).toHaveCount(0);
    await expect(page.getByText("mileage rate", { exact: false })).toHaveCount(0);
    await expect(page.getByText("oil change", { exact: false })).toHaveCount(0);
    await expect(page.getByText("yearly goal", { exact: false })).toHaveCount(0);
    await expect(page.getByText("reference location", { exact: false })).toHaveCount(0);
    await expect(page.getByText("latitude", { exact: false })).toHaveCount(0);
    await expect(page.getByText("longitude", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  });

  await recorder.step("Enter ride edit mode and confirm only ride metadata can be edited", async () => {
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(page.locator('input[id^="edit-ride-miles-"]')).toBeVisible();
    await expect(page.locator('input[id^="edit-ride-temperature-"]')).toBeVisible();
    await expect(page.locator('input[id^="edit-ride-gas-price-"]')).toBeVisible();
    await expect(page.locator('select[id^="edit-ride-direction-"]')).toBeVisible();
    await expect(page.locator('select[id^="edit-ride-difficulty-"]')).toBeVisible();
    await expect(page.locator('textarea[id^="edit-ride-note-"]')).toBeVisible();

    await expect(page.getByText("average car mpg", { exact: false })).toHaveCount(0);
    await expect(page.getByText("mileage rate", { exact: false })).toHaveCount(0);
    await expect(page.getByText("oil change", { exact: false })).toHaveCount(0);
    await expect(page.getByText("yearly goal", { exact: false })).toHaveCount(0);
    await expect(page.getByText("reference location", { exact: false })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:history_page_does_not_expose_rider_settings");
  await recorder.save(testInfo);
});
