import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupHealthyStartupGuard,
  setupRecordRideScenario,
} from "../../helpers/mock-api.js";

test("ride creation requires miles positive and <= 200", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ride_creation_miles_required_positive",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated session and ride page mocks", async () => {
    await setupAuthenticatedSession(page);
    await setupHealthyStartupGuard(page);
    await setupRecordRideScenario(page, {
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

  await recorder.step("Enter supporting values that must be preserved", async () => {
    await page.locator("#notes").fill("Great ride!");
    await page.locator("#gasPrice").fill("3.50");
  });

  await recorder.step("Submit with blank miles", async () => {
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Miles must be greater than 0")).toBeVisible();
    await expect(page.locator("#notes")).toHaveValue("Great ride!");
    await expect(page.locator("#gasPrice")).toHaveValue("3.50");
  });

  await recorder.step("Submit with negative miles", async () => {
    await page.locator("#miles").fill("-5");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Miles must be greater than 0")).toBeVisible();
    await expect(page.locator("#miles")).toHaveValue("-5");
    await expect(page.locator("#notes")).toHaveValue("Great ride!");
  });

  await recorder.step("Submit with zero miles", async () => {
    await page.locator("#miles").fill("0");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Miles must be greater than 0")).toBeVisible();
    await expect(page.locator("#miles")).toHaveValue("0");
  });

  await recorder.step("Submit with miles above max", async () => {
    await page.locator("#miles").fill("201");
    await page.getByRole("button", { name: "Record Ride" }).click();
    await expect(page.getByText("Miles must be less than or equal to 200")).toBeVisible();
    await expect(page.locator("#miles")).toHaveValue("201");
    await expect(page.locator("#notes")).toHaveValue("Great ride!");
    await expect(page.locator("#gasPrice")).toHaveValue("3.50");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:ride_creation_miles_required_positive");
  await recorder.save(testInfo);
});
