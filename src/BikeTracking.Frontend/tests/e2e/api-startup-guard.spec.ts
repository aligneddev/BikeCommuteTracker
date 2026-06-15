/**
 * Playwright E2E test: ApiStartupGuard startup flow
 *
 * Scenario: Navigate to the app root and verify the connecting state is shown
 * immediately, then transitions to the main app once the health check succeeds.
 *
 * Prerequisites:
 *   - The .NET API must be running on http://localhost:55436 (or the value
 *     configured by VITE_API_BASE_URL / window.__BIKE_API_URL__)
 *   - Run with: npm run test:e2e -- api-startup-guard
 *
 * TDD: This test is written RED — it will fail until ApiStartupGuard is
 * implemented and wraps the app router in App.tsx.
 */

import { test, expect } from '@playwright/test'

test.describe('ApiStartupGuard', () => {
  test('shows connecting indicator within 1 second of page load, then transitions to app', async ({
    page,
  }) => {
    // Navigate to the app root
    await page.goto('/')

    // Within 1 000 ms the connecting indicator must be visible
    // The component renders role="status" with text matching /connecting/i
    const connectingIndicator = page.getByRole('status', { name: /connecting/i })
    await expect(connectingIndicator).toBeVisible({ timeout: 1000 })

    // Once the health check succeeds, the connecting indicator disappears
    // and the login page (or main app) renders
    await expect(connectingIndicator).not.toBeVisible({ timeout: 15000 })

    // The login page should now be visible — there should be no connecting indicator
    // and the page should have navigated or rendered the main content
    await expect(page.getByRole('status', { name: /connecting/i })).not.toBeVisible()
  })

  test('shows error state with Retry button if API is unreachable after timeout', async ({
    page,
    context,
  }) => {
    // Block all requests to the health endpoint to simulate an unreachable API
    await context.route('**/health', (route) => route.abort())

    await page.goto('/')

    // Should see the error alert after the 10 s timeout (20 attempts × 500 ms)
    const errorAlert = page.getByRole('alert')
    await expect(errorAlert).toBeVisible({ timeout: 15000 })

    // Retry button must be present
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
  })
})
