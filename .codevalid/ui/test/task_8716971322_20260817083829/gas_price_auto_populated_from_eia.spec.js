import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupRecordRidePageScenario,
} from "../../helpers/mock-api.js";
import { eiaGasPriceResponse } from "../../mock/mock-data.js";

test("gas price is auto-populated from EIA API for ride date", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "gas_price_auto_populated_from_eia",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and gas price API response", async () => {
    await setupAuthenticatedSession(page);
    await setupRecordRidePageScenario(page, {
      gasPriceResponse: eiaGasPriceResponse,
    });
  });

  await recorder.step("Open the Record Ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  });

  await recorder.step("Verify gas price and source are displayed", async () => {
    await expect(page.locator("#gasPrice")).toHaveValue("3.65");
    await expect(page.getByText("Source: U.S. Energy Information Administration (EIA)")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:gas_price_auto_populated_from_eia");
  await recorder.save(testInfo);
});
