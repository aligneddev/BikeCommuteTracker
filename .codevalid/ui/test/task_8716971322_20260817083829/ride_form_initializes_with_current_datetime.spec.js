import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";

test("ride form initializes with current local date/time on new ride", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_form_initializes_with_current_datetime",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and empty ride page data", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      gasPriceResponse: {
        date: "2024-06-10",
        pricePerGallon: null,
        isAvailable: false,
        dataSource: null,
      },
    });
  });

  await recorder.step("Open the Record Ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Verify date/time auto-populates and other fields start blank", async () => {
    const dateTimeValue = await page.locator("#rideDateTimeLocal").inputValue();
    expect(dateTimeValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    await expect(page.locator("#miles")).toHaveValue("");
    await expect(page.locator("#rideMinutes")).toHaveValue("");
    await expect(page.locator("#temperature")).toHaveValue("");
    await expect(page.locator("#windSpeedMph")).toHaveValue("");
    await expect(page.locator("#windDirectionDeg")).toHaveValue("");
    await expect(page.locator("#relativeHumidityPercent")).toHaveValue("");
    await expect(page.locator("#cloudCoverPercent")).toHaveValue("");
    await expect(page.locator("#precipitationType")).toHaveValue("");
    await expect(page.locator("#notes")).toHaveValue("");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_form_initializes_with_current_datetime");
  await recorder.save(testInfo);
});
