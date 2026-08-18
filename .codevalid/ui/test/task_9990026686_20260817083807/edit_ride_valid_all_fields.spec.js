import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession } from "../../helpers/mock-api.js";

const baseHistoryResponse = {
  summaries: {
    thisMonth: { miles: 10.2, rideCount: 1, period: "thisMonth" },
    thisYear: { miles: 10.2, rideCount: 1, period: "thisYear" },
    allTime: { miles: 10.2, rideCount: 1, period: "allTime" },
  },
  filteredTotal: { miles: 10.2, rideCount: 1, period: "filtered" },
  rides: [
    {
      rideId: 101,
      rideDateTimeLocal: "2024-06-15T07:30:00",
      miles: 10.2,
      rideMinutes: 35,
      temperature: 68,
      gasPricePerGallon: 3.5,
      windSpeedMph: 15,
      windDirectionDeg: 270,
      relativeHumidityPercent: 50,
      cloudCoverPercent: 20,
      precipitationType: "None",
      note: "Good ride",
      difficulty: 4,
      primaryTravelDirection: "NE",
      windResistanceRating: 1,
    },
  ],
  page: 1,
  pageSize: 25,
  totalRows: 1,
};

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function setupHistoryScenario(page, options = {}) {
  let history = structuredClone(options.history ?? baseHistoryResponse);
  const gasPrice = options.gasPrice ?? {
    date: "2024-06-15",
    pricePerGallon: 3.75,
    isAvailable: true,
    dataSource: "Source: U.S. Energy Information Administration (EIA)",
  };
  const weather = options.weather ?? {
    rideDateTimeLocal: "2024-06-15T07:30",
    temperature: 70,
    windSpeedMph: 15,
    windDirectionDeg: 270,
    relativeHumidityPercent: 55,
    cloudCoverPercent: 25,
    precipitationType: "None",
    isAvailable: true,
  };

  await page.route("**/health", async (route) => json(route, 200, { status: "ok" }));
  await page.route("**/api/rides/history**", async (route) => json(route, 200, history));
  await page.route("**/api/rides/gas-price**", async (route) => json(route, 200, gasPrice));
  await page.route("**/api/rides/weather**", async (route) => json(route, 200, weather));
  await page.route(/.*\/api\/rides\/101$/, async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const body = route.request().postDataJSON();
      history = {
        ...history,
        filteredTotal: { ...history.filteredTotal, miles: body.miles, rideCount: 1, period: "filtered" },
        summaries: {
          thisMonth: { miles: body.miles, rideCount: 1, period: "thisMonth" },
          thisYear: { miles: body.miles, rideCount: 1, period: "thisYear" },
          allTime: { miles: body.miles, rideCount: 1, period: "allTime" },
        },
        rides: [
          {
            ...history.rides[0],
            rideDateTimeLocal: body.rideDateTimeLocal,
            miles: body.miles,
            temperature: body.temperature,
            gasPricePerGallon: body.gasPricePerGallon,
            windSpeedMph: body.windSpeedMph,
            windDirectionDeg: body.windDirectionDeg,
            relativeHumidityPercent: body.relativeHumidityPercent,
            cloudCoverPercent: body.cloudCoverPercent,
            precipitationType: body.precipitationType,
            note: body.note,
            difficulty: body.difficulty,
            primaryTravelDirection: body.primaryTravelDirection,
            windResistanceRating: 1,
          },
        ],
      };
      return json(route, 200, { rideId: 101, newVersion: 2, message: "Ride updated." });
    }
    return route.fallback();
  });
}

test("edit_ride_valid_all_fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "edit_ride_valid_all_fields",
    testTitle: testInfo.title,
  });

  await recorder.step("setup authenticated edit history scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupHistoryScenario(page);
  });

  await recorder.step("open ride history", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("10.2 mi")).toBeVisible();
  });

  await recorder.step("enter edit mode", async () => {
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#edit-ride-miles-101")).toBeVisible();
  });

  await recorder.step("update editable fields and save", async () => {
    await page.locator("#edit-ride-miles-101").fill("15.5");
    await page.locator("#edit-ride-gas-price-101").fill("3.75");
    await page.locator("#edit-ride-note-101").fill("Excellent ride on a sunny day.");
    await page.locator("#edit-ride-direction-101").selectOption("NE");
    await page.locator("#edit-ride-difficulty-101").selectOption("3");
    await page.getByRole("button", { name: "Save" }).click();
  });

  await recorder.step("verify updated row values are shown", async () => {
    await expect(page.locator("#edit-ride-miles-101")).toHaveCount(0);
    await expect(page.getByText("15.5 mi")).toBeVisible();
    await page.getByRole("button", { name: "View ride note" }).click();
    await expect(page.getByRole("tooltip")).toContainText("Excellent ride on a sunny day.");
    await expect(page.getByText("$3.7500")).toBeVisible();
    await expect(page.getByText(/^3$/)).toBeVisible();
    await expect(page.getByText(/^NE$/)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:edit_ride_valid_all_fields");
  await recorder.save(testInfo);
});
