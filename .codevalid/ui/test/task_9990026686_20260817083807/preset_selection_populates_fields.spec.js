import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";
import { morningCommutePreset, presetWeatherResponse } from "../../mock/mock-data.js";

test("preset selection populates direction time duration and miles", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "preset_selection_populates_fields",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed preset scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page, {
      presets: [morningCommutePreset],
      weatherResponse: presetWeatherResponse,
      gasPriceResponse: {
        date: "2026-08-18",
        pricePerGallon: 3.45,
        isAvailable: true,
        dataSource: "Source: U.S. Energy Information Administration (EIA)",
      },
    });
  });

  await recorder.step("Open record ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Select preset", async () => {
    await page.locator("#ridePreset").selectOption(String(morningCommutePreset.presetId));
  });

  await recorder.step("Assert populated fields remain editable", async () => {
    await expect(page.locator("#primaryTravelDirection")).toHaveValue("North");
    await expect(page.locator("#rideMinutes")).toHaveValue("55");
    await expect(page.locator("#miles")).toHaveValue("12");
    await expect(page.locator("#rideDateTimeLocal")).toHaveValue(/T07:30$/);
    await expect(page.locator("#gasPrice")).toHaveValue("3.45");
    await expect(page.locator("#notes")).toHaveValue("");

    await page.locator("#miles").fill("13");
    await expect(page.locator("#miles")).toHaveValue("13");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:preset_selection_populates_fields");
  await recorder.save(testInfo);
});
