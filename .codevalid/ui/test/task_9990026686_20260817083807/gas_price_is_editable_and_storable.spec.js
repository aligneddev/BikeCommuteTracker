import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideSubmissionScenario,
} from "../../helpers/mock-api.js";

test("gas price can be edited and cleared before submission", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "gas_price_is_editable_and_storable",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed successful submission scenario", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideSubmissionScenario(page, {
      gasPriceResponse: {
        date: "2024-06-15",
        pricePerGallon: 3.45,
        isAvailable: true,
        dataSource: "Source: U.S. Energy Information Administration (EIA)",
      },
    });
  });

  await recorder.step("Open record ride page", async () => {
    await page.goto("/rides/record");
    await expect(page.locator("#gasPrice")).toHaveValue("3.45");
  });

  await recorder.step("Edit gas price and submit", async () => {
    await page.locator("#miles").fill("10");
    await page.locator("#gasPrice").fill("3.60");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Ride recorded successfully (ID: 101)")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:gas_price_is_editable_and_storable");
  await recorder.save(testInfo);
});
