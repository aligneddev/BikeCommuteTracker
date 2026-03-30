import { expect, type Page } from "@playwright/test";

export interface RideFormInput {
  rideDateTimeLocal?: string;
  miles: string;
  rideMinutes?: string;
  temperature?: string;
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function recordRide(
  page: Page,
  input: RideFormInput,
): Promise<void> {
  await page.goto("/rides/record");

  await page
    .locator("#rideDateTimeLocal")
    .fill(input.rideDateTimeLocal ?? toDateTimeLocalValue(new Date()));
  await page.locator("#miles").fill(input.miles);

  if (input.rideMinutes !== undefined) {
    await page.locator("#rideMinutes").fill(input.rideMinutes);
  }

  if (input.temperature !== undefined) {
    await page.locator("#temperature").fill(input.temperature);
  }

  await page.getByRole("button", { name: "Record Ride" }).click();
  await expect(page.getByText(/ride recorded successfully/i)).toBeVisible();
}

export async function selectQuickRideOption(
  page: Page,
  labelPattern: RegExp,
): Promise<void> {
  await page.getByRole("button", { name: labelPattern }).click();
}
