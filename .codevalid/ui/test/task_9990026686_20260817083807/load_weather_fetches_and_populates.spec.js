import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";
import { loadWeatherResponse } from "../../mock/mock-data.js";

test("weather lookup populates weather fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "load_weather_fetches_and_populates",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed weather scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page, {
      weatherResponse: loadWeatherResponse,
    });
  });

  await recorder.step("Open record ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Set ride datetime and load weather", async () => {
    await page.locator("#rideDateTimeLocal").fill("2024-06-10T14:25");
    await page.getByRole("button", { name: "Load Weather" }).click();
  });

  await recorder.step("Assert populated weather values", async () => {
    await expect(page.locator("#temperature")).toHaveValue(String(loadWeatherResponse.temperature));
    await expect(page.locator("#windSpeedMph")).toHaveValue(String(loadWeatherResponse.windSpeedMph));
    await expect(page.locator("#windDirectionDeg")).toHaveValue(String(loadWeatherResponse.windDirectionDeg));
    await expect(page.locator("#relativeHumidityPercent")).toHaveValue(String(loadWeatherResponse.relativeHumidityPercent));
    await expect(page.locator("#cloudCoverPercent")).toHaveValue(String(loadWeatherResponse.cloudCoverPercent));
    await expect(page.locator("#precipitationType")).toHaveValue(loadWeatherResponse.precipitationType);
    await expect(page.getByText(/^Ride recorded successfully/)).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:load_weather_fetches_and_populates");
  await recorder.save(testInfo);
});
