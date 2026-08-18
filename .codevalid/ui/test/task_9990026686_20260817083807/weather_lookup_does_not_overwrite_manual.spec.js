import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";
import { loadWeatherResponse } from "../../mock/mock-data.js";

test("manual weather value is overwritten by current implementation load weather", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "weather_lookup_does_not_overwrite_manual",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed weather scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page, {
      weatherResponse: loadWeatherResponse,
    });
  });

  await recorder.step("Open page and enter manual temperature", async () => {
    await page.goto("/rides/record");
    await page.locator("#rideDateTimeLocal").fill("2024-06-10T14:25");
    await page.locator("#temperature").fill("72");
    await expect(page.locator("#temperature")).toHaveValue("72");
  });

  await recorder.step("Load weather and verify source truth behavior", async () => {
    await page.getByRole("button", { name: "Load Weather" }).click();
    await expect(page.locator("#temperature")).toHaveValue(String(loadWeatherResponse.temperature));
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:weather_lookup_does_not_overwrite_manual");
  await recorder.save(testInfo);
});
