import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import {
  expenseSummaryCard,
  expenseSummaryRow,
  recordExpense,
} from "./support/expense-helpers";
import { recordRide } from "./support/ride-helpers";

const TEST_PIN = "87654321";

async function saveOilChangePrice(
  page: import("@playwright/test").Page,
  oilChangePrice: string,
): Promise<void> {
  await page.goto("/settings");
  await page.locator("#oilChangePrice").fill(oilChangePrice);
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText(/settings saved successfully/i)).toBeVisible();
}

async function recordMilesForOilInterval(
  page: import("@playwright/test").Page,
  totalMiles: number,
): Promise<void> {
  const rideCount = totalMiles / 200;

  for (let index = 0; index < rideCount; index += 1) {
    const rideDate = new Date(Date.UTC(2026, 3, 1, 12, index, 0));
    const rideDateTimeLocal = rideDate.toISOString().slice(0, 16);

    await recordRide(page, {
      rideDateTimeLocal,
      miles: "200",
    });
  }
}

test.describe("015-savings-calculation e2e", () => {
  test("dashboard recalculates net expense total after oil price changes", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-dashboard-savings");

    await createAndLoginUser(page, userName, TEST_PIN);
    await recordExpense(page, {
      expenseDate: "2026-04-17",
      amount: "40.00",
      note: "Tube replacement",
    });
    await recordMilesForOilInterval(page, 3000);
    await saveOilChangePrice(page, "25");

    await page.goto("/dashboard");

    const card = expenseSummaryCard(page);
    await expect(card.locator(".dashboard-summary-card-value")).toContainText(
      "$15.00",
    );
    await expect(expenseSummaryRow(card, "Oil Change Savings")).toContainText(
      "$25.00",
    );
    await expect(expenseSummaryRow(card, "Net Expenses")).toContainText(
      "$15.00",
    );

    await saveOilChangePrice(page, "50");
    await page.goto("/dashboard");

    await expect(card.locator(".dashboard-summary-card-value")).toContainText(
      "-$10.00",
    );
    await expect(expenseSummaryRow(card, "Oil Change Savings")).toContainText(
      "$50.00",
    );
    await expect(expenseSummaryRow(card, "Net Savings")).toContainText(
      "-$10.00",
    );
  });
});
