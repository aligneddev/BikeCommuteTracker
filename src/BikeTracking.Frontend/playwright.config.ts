import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:9000'

/**
 * E2E smoke tests for BikeTracking frontend (User Login feature).
 *
 * Prerequisites:
 *   - Vite dev server running on http://localhost:9000  (`npm run dev`)
 *   - .NET API running on http://localhost:5436         (`dotnet run --project src/BikeTracking.Api`)
 *   OR launch the full Aspire stack:                    (`dotnet run --project src/BikeTracking.AppHost`)
 *
 * Run:  npx playwright test  (from src/BikeTracking.Frontend)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'dotnet run --project ../BikeTracking.Api',
      url: 'http://localhost:5436/',
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 180000,
      env: {
        // Use a dedicated E2E database so test runs never touch the local dev DB.
        // ASP.NET Core maps ConnectionStrings__<name> to ConnectionStrings[name].
        ConnectionStrings__BikeTracking: 'Data Source=biketracking.e2e.db',
      },
    },
    {
      command: 'npm run dev -- --host localhost --port 9000',
      url: 'http://localhost:9000/login',
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
