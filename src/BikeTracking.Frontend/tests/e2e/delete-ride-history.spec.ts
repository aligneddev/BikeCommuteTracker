import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordRide } from "./support/ride-helpers";

const SESSION_KEY = "bike_tracking_auth_session";
const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:55436";

async function getCurrentUserId(
  page: import("@playwright/test").Page,
): Promise<number> {
  return page.evaluate((sessionKey) => {
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) {
      throw new Error("Missing auth session in sessionStorage");
    }

    const parsed = JSON.parse(raw) as { userId?: number };
    if (typeof parsed.userId !== "number") {
      throw new Error("Auth session does not contain numeric userId");
    }

    return parsed.userId;
  }, SESSION_KEY);
}

test.describe("007-delete-ride-history e2e", () => {
  test("deletes a ride from history and refreshes totals", async ({ page }) => {
    const userName = uniqueUser("e2e-delete-history");
    await createAndLoginUser(page, userName, "87654321");

    await recordRide(page, {
      rideDateTimeLocal: "2026-03-20T10:30",
      miles: "5.0",
      rideMinutes: "30",
      temperature: "70",
    });

    await recordRide(page, {
      rideDateTimeLocal: "2026-03-21T08:15",
      miles: "10.0",
      rideMinutes: "45",
      temperature: "66",
    });

    await page.goto("/rides/history");
    await expect(
      page.getByRole("table", { name: /ride history table/i }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Visible total miles").getByText("15.0 mi"),
    ).toBeVisible();

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.locator('[data-testid="delete-dialog"]');
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: /confirm delete/i }).click();

    await expect(page.getByRole("row")).toHaveCount(2); // header + 1 remaining ride
    await expect(
      page.getByLabel("Visible total miles").getByText("15.0 mi"),
    ).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole("row")).toHaveCount(2); // header + 1 remaining ride
    await expect(
      page.getByLabel("Visible total miles").getByText("15.0 mi"),
    ).not.toBeVisible();
  });

  test("cancel in confirmation dialog does not delete ride", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-delete-cancel");
    await createAndLoginUser(page, userName, "87654321");

    await recordRide(page, {
      rideDateTimeLocal: "2026-03-22T09:00",
      miles: "7.5",
      rideMinutes: "28",
      temperature: "62",
    });

    await page.goto("/rides/history");
    await expect(
      page.getByRole("table", { name: /ride history table/i }),
    ).toBeVisible();

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.locator('[data-testid="delete-dialog"]');
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: /^Cancel$/i }).click();

    await expect(deleteDialog).not.toBeVisible();
    await expect(
      page.getByLabel("Visible total miles").getByText("7.5 mi"),
    ).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2);
  });

  test("second delete request for same ride is idempotent", async ({
    page,
    request,
  }) => {
    const userName = uniqueUser("e2e-delete-idempotent");
    await createAndLoginUser(page, userName, "87654321");

    await recordRide(page, {
      rideDateTimeLocal: "2026-03-23T09:30",
      miles: "12.0",
      rideMinutes: "50",
      temperature: "60",
    });

    await page.goto("/rides/history");
    await expect(
      page.getByRole("table", { name: /ride history table/i }),
    ).toBeVisible();

    const userId = await getCurrentUserId(page);
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/rides/history`,
      {
        headers: { "X-User-Id": userId.toString() },
      },
    );
    expect(historyResponse.ok()).toBeTruthy();

    const historyPayload = (await historyResponse.json()) as {
      rides: Array<{ rideId: number }>;
    };
    const rideId = historyPayload.rides[0]?.rideId;
    expect(typeof rideId).toBe("number");

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: "Delete" }).click();
    const deleteDialog = page.locator('[data-testid="delete-dialog"]');
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: /confirm delete/i }).click();
    await expect(page.getByText(/no rides found/i)).toBeVisible();

    const secondDeleteResponse = await request.delete(
      `${API_BASE_URL}/api/rides/${rideId}`,
      {
        headers: { "X-User-Id": userId.toString() },
      },
    );
    expect(secondDeleteResponse.status()).toBe(200);

    const secondDeletePayload = (await secondDeleteResponse.json()) as {
      isIdempotent?: boolean;
    };
    expect(secondDeletePayload.isIdempotent).toBe(true);
  });

  test("cross-user delete attempt is forbidden and owner ride remains", async ({
    page,
    browser,
    request,
  }) => {
    const ownerName = uniqueUser("e2e-delete-owner");
    await createAndLoginUser(page, ownerName, "87654321");

    await recordRide(page, {
      rideDateTimeLocal: "2026-03-24T09:15",
      miles: "9.0",
      rideMinutes: "35",
      temperature: "58",
    });

    const ownerUserId = await getCurrentUserId(page);
    const ownerHistoryResponse = await request.get(
      `${API_BASE_URL}/api/rides/history`,
      {
        headers: { "X-User-Id": ownerUserId.toString() },
      },
    );
    expect(ownerHistoryResponse.ok()).toBeTruthy();

    const ownerHistoryPayload = (await ownerHistoryResponse.json()) as {
      rides: Array<{ rideId: number }>;
    };
    const ownerRideId = ownerHistoryPayload.rides[0]?.rideId;
    expect(typeof ownerRideId).toBe("number");

    const attackerPage = await browser.newPage();
    try {
      const attackerName = uniqueUser("e2e-delete-attacker");
      await createAndLoginUser(attackerPage, attackerName, "87654321");
      const attackerUserId = await getCurrentUserId(attackerPage);

      const forbiddenResponse = await request.delete(
        `${API_BASE_URL}/api/rides/${ownerRideId}`,
        {
          headers: { "X-User-Id": attackerUserId.toString() },
        },
      );

      expect(forbiddenResponse.status()).toBe(403);

      const ownerHistoryAfterResponse = await request.get(
        `${API_BASE_URL}/api/rides/history`,
        {
          headers: { "X-User-Id": ownerUserId.toString() },
        },
      );
      expect(ownerHistoryAfterResponse.ok()).toBeTruthy();

      const ownerHistoryAfterPayload =
        (await ownerHistoryAfterResponse.json()) as {
          rides: Array<{ rideId: number }>;
        };

      expect(
        ownerHistoryAfterPayload.rides.some((r) => r.rideId === ownerRideId),
      ).toBe(true);
    } finally {
      await attackerPage.close();
    }
  });
});
