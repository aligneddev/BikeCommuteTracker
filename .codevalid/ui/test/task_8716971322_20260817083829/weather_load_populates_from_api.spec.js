import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";
import { defaultRideWeather } from "../../mock/mock-data.js";

test("weather data auto-populates from API call when Load Weather is triggered", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "weather_load_populates_from_api",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and weather API response", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      weatherResponse: defaultRideWeather,
    });
  });

  await recorder.step("Open the Record Ride page and set a valid ride date/time", async () => {
    await page.goto("/rides/record");
    await page.locator("#rideDateTimeLocal").fill("2024-06-10T10:00");
  });

  await recorder.step("Trigger weather loading", async () => {
    await page.getByRole("button", { name: "Load Weather" }).click();
  });

  await recorder.step("Verify weather fields populate from API data", async () => {
    await expect(page.locator("#temperature")).toHaveValue(String(defaultRideWeather.temperature));
    await expect(page.locator("#windSpeedMph")).toHaveValue(String(defaultRideWeather.windSpeedMph));
    await expect(page.locator("#windDirectionDeg")).toHaveValue(String(defaultRideWeather.windDirectionDeg));
    await expect(page.locator("#relativeHumidityPercent")).toHaveValue(String(defaultRideWeather.relativeHumidityPercent));
    await expect(page.locator("#cloudCoverPercent")).toHaveValue(String(defaultRideWeather.cloudCoverPercent));
    await expect(page.locator("#precipitationType")).toHaveValue(defaultRideWeather.precipitationType);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:weather_load_populates_from_api");
  await recorder.save(testInfo);
});
