import { expect, test } from '@playwright/test'

// E2E scenarios for spec-006-edit-ride-history
// Prerequisites: User signed up and recorded at least one ride
// Tests: inline edit mode, validation, conflict handling, and totals refresh

test.describe('006-edit-ride-history e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and record a ride to have history
    await page.goto('/signup')
    await page.getByLabel(/^name$/i).fill('E2E Test Rider')
    await page.getByLabel(/^pin$/i).fill('1234')
    await page.getByRole('button', { name: /sign up/i }).click()

    // We should now be on /login
    await expect(page.getByText(/welcome back/i)).toBeVisible()

    // Auto-login happens on the page, so move to record ride
    await page.goto('/miles')

    // Record a ride
    await page.getByLabel(/ride date/i).fill('2026-03-20')
    await page.getByLabel(/ride time/i).fill('10:30')
    await page
      .getByRole('spinbutton', { name: /^miles/i })
      .first()
      .fill('5.0')
    await page.getByLabel(/ride minutes/i).fill('30')
    await page.getByLabel(/temperature/i).fill('70')
    await page.getByRole('button', { name: /record ride/i }).click()

    // Navigate to history
    await page.goto('/miles/history')
    await expect(page.getByRole('table', { name: /ride history table/i })).toBeVisible()
  })

  test('enters edit mode, modifies miles, saves successfully, and refreshes totals', async ({
    page,
  }) => {
    // Find the Edit button for the ride row and click it
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await editButton.click()

    // Save and Cancel buttons should appear
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()

    // Change miles value
    const milesInput = page.getByRole('spinbutton', { name: /miles/i }).first()
    await milesInput.clear()
    await milesInput.fill('8.5')

    // Click Save
    await page.getByRole('button', { name: /save/i }).click()

    // Verify the row updates to show new miles value
    await expect(page.getByText('8.5 mi')).toBeVisible()

    // Verify summary cards refresh (all should show 8.5)
    const summaryMiles = page.locator('[class*="mileage-summary-miles"]')
    const count = await summaryMiles.count()
    for (let i = 0; i < count; i++) {
      const text = await summaryMiles.nth(i).textContent()
      expect(text).toContain('8.5 mi')
    }
  })

  test('blocks save and shows validation message for invalid miles', async ({ page }) => {
    // Enter edit mode
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await editButton.click()

    // Try to set miles to 0
    const milesInput = page.getByRole('spinbutton', { name: /miles/i }).first()
    await milesInput.clear()
    await milesInput.fill('0')

    // Click Save
    await page.getByRole('button', { name: /save/i }).click()

    // Expect validation error message
    await expect(
      page.getByRole('alert', { name: /miles must be greater than 0/i })
    ).toBeVisible()

    // Edit mode should remain active
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('cancels edit and discards in-progress changes', async ({ page }) => {
    // Capture original value
    const originalText = await page.locator('tbody tr').first().locator('td').nth(1).textContent()
    expect(originalText).toContain('5.0 mi')

    // Enter edit mode
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await editButton.click()

    // Modify miles but do NOT save
    const milesInput = page.getByRole('spinbutton', { name: /miles/i }).first()
    await milesInput.clear()
    await milesInput.fill('99.0')

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click()

    // Edit mode should exit and original value should be restored
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible()
    const restoreText = await page.locator('tbody tr').first().locator('td').nth(1).textContent()
    expect(restoreText).toContain('5.0 mi')
  })

  test('shows summary cards with historical totals and active filter', async ({ page }) => {
    // Apply a date filter (from starting date to end of month)
    const fromInput = page.getByLabel(/^From$/i)
    const toInput = page.getByLabel(/^To$/i)

    await fromInput.fill('2026-03-15')
    await toInput.fill('2026-03-31')
    await page.getByRole('button', { name: /apply filter/i }).click()

    // Summary cards should be visible
    await expect(page.getByText(/this month/i)).toBeVisible()
    await expect(page.getByText(/5.0 mi/)).toBeVisible()

    // Edit the ride to 10 miles
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await editButton.click()

    const milesInput = page.getByRole('spinbutton', { name: /miles/i }).first()
    await milesInput.clear()
    await milesInput.fill('10.0')

    await page.getByRole('button', { name: /save/i }).click()

    // Totals should update to reflect new 10 mi value
    const summaryCards = page.getByText(/this month/i)
    await expect(summaryCards).toBeVisible()
    // The visible total should update
    await expect(page.getByText('10.0 mi')).toBeVisible()
  })
})
