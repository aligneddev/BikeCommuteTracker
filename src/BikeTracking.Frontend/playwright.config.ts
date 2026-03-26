import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9000";
const e2eApiUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:55436";

/**
 * E2E smoke tests for BikeTracking frontend (User Login feature).
 *
 * Prerequisites:
 *  Preferred: launch the full Aspire stack:                    (`dotnet run --project src/BikeTracking.AppHost`)
 *   OR 
 *   - Vite dev server running on http://localhost:9000  (`npm run dev`)
 *   - .NET API running on http://localhost:55436        (`dotnet run --no-launch-profile --project src/BikeTracking.Api`)
 *
 * Run:  npx playwright test  (from src/BikeTracking.Frontend)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "dotnet run --no-launch-profile --project ../BikeTracking.Api",
      url: `${e2eApiUrl}/`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180000,
      env: {
        ASPNETCORE_URLS: e2eApiUrl,
        // Use a dedicated E2E database so test runs never touch the local dev DB.
        // ASP.NET Core maps ConnectionStrings__<name> to ConnectionStrings[name].
        ConnectionStrings__BikeTracking: "Data Source=biketracking.e2e.db",
      },
    },
    {
      command: `VITE_API_BASE_URL=${e2eApiUrl} npm run dev -- --host localhost --port 9000`,
      url: "http://localhost:9000/login",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
