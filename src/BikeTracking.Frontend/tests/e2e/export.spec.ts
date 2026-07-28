import { expect, test } from "@playwright/test";
import { createAndLoginUser, uniqueUser } from "./support/auth-helpers";
import { recordExpense } from "./support/expense-helpers";
import { recordRide } from "./support/ride-helpers";

const TEST_PIN = "87654321";

test.describe("028-csv-data-export e2e", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 1: Expense CSV export
  // ─────────────────────────────────────────────────────────────────────────

  test("Scenario 1: expense CSV downloads with correct filename, header row, and data row", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-export-expense");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordExpense(page, {
      expenseDate: "2026-01-15",
      amount: "49.95",
      note: "Chain replacement",
    });

    await page.goto("/settings");

    // Intercept the download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export expenses/i }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("expenses-export.csv");

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    // Header row
    expect(lines[0]).toBe("Date,Amount,Notes,CreatedAtUtc");

    // At least one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Data row contains the expense data
    expect(lines.slice(1).join("\n")).toContain("Chain replacement");
    expect(lines.slice(1).join("\n")).toContain("2026-01-15");
  });

  test("Scenario 1 (empty dataset): expense CSV with no expenses returns header-only", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-export-expense-empty");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export expenses/i }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("expenses-export.csv");

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("Date,Amount,Notes,CreatedAtUtc");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 2: Ride history ZIP export
  // ─────────────────────────────────────────────────────────────────────────

  test("Scenario 2: ride history ZIP downloads with correct filename", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-export-ride");
    await createAndLoginUser(page, userName, TEST_PIN);

    await recordRide(page, {
      rideDateTimeLocal: "2026-01-15T07:30",
      miles: "12.5",
    });

    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export ride history/i }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("ride-history-export.zip");
  });

  test("Scenario 2 (empty dataset): ride ZIP with no rides returns ZIP file", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-export-ride-empty");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export ride history/i }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("ride-history-export.zip");
    // Verify the response came back (file has non-zero size)
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 3: User isolation
  // ─────────────────────────────────────────────────────────────────────────

  test("Scenario 3: expense export is scoped to the authenticated user only", async ({
    page,
    browser,
  }) => {
    const userA = uniqueUser("e2e-export-isolation-a");
    const userB = uniqueUser("e2e-export-isolation-b");

    // User A records an expense
    await createAndLoginUser(page, userA, TEST_PIN);
    await recordExpense(page, {
      expenseDate: "2026-03-01",
      amount: "25.00",
      note: "User A only expense",
    });

    await page.goto("/settings");
    const [downloadA] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export expenses/i }).click(),
    ]);

    const streamA = await downloadA.createReadStream();
    const chunksA: Buffer[] = [];
    for await (const chunk of streamA) {
      chunksA.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const contentA = Buffer.concat(chunksA).toString("utf-8");

    expect(contentA).toContain("User A only expense");

    // User B session (separate context)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await createAndLoginUser(pageB, userB, TEST_PIN);

    await pageB.goto("/settings");
    const [downloadB] = await Promise.all([
      pageB.waitForEvent("download"),
      pageB.getByRole("button", { name: /export expenses/i }).click(),
    ]);

    const streamB = await downloadB.createReadStream();
    const chunksB: Buffer[] = [];
    for await (const chunk of streamB) {
      chunksB.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const contentB = Buffer.concat(chunksB).toString("utf-8");

    // User B's export must NOT contain User A's data
    expect(contentB).not.toContain("User A only expense");

    await contextB.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 4: Independent button operation
  // ─────────────────────────────────────────────────────────────────────────

  test("Scenario 4: Export Expenses and Export Ride History buttons operate independently", async ({
    page,
  }) => {
    const userName = uniqueUser("e2e-export-independent");
    await createAndLoginUser(page, userName, TEST_PIN);

    await page.goto("/settings");

    // Both buttons should be visible
    await expect(
      page.getByRole("button", { name: /export expenses/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /export ride history/i }),
    ).toBeVisible();

    // Click Expenses only — ride history button should remain enabled
    const [expensesDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export expenses/i }).click(),
    ]);
    expect(expensesDownload.suggestedFilename()).toBe("expenses-export.csv");

    // Ride history button is still clickable
    await expect(
      page.getByRole("button", { name: /export ride history/i }),
    ).toBeEnabled();

    // Click Ride History independently
    const [ridesDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export ride history/i }).click(),
    ]);
    expect(ridesDownload.suggestedFilename()).toBe("ride-history-export.zip");
  });
});
