import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./pages/login/login-page', () => ({
  LoginPage: () => <div>Login Page</div>,
}))
vi.mock('./pages/signup/signup-page', () => ({
  SignupPage: () => <div>Signup Page</div>,
}))
vi.mock('./pages/dashboard/dashboard-page', () => ({
  DashboardPage: () => <div>Dashboard Page</div>,
}))
vi.mock('./pages/miles/miles-shell-page', () => ({
  MilesShellPage: () => <div>Miles Page</div>,
}))
vi.mock('./pages/RecordRidePage', () => ({
  RecordRidePage: () => <div>Record Ride Page</div>,
}))
vi.mock('./pages/HistoryPage', () => ({
  HistoryPage: () => <div>History Page</div>,
}))
vi.mock('./pages/settings/SettingsPage', () => ({
  SettingsPage: () => <div>Settings Page</div>,
}))
vi.mock('./pages/import-rides/ImportRidesPage', () => ({
  ImportRidesPage: () => <div>Import Rides Page</div>,
}))
vi.mock('./pages/expenses/ExpenseImportPage', () => ({
  ExpenseImportPage: () => <div>Expense Import Page</div>,
}))
vi.mock('./components/app-header/app-header', () => ({
  AppHeader: () => <div>App Header</div>,
}))

describe('App routing', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState({}, '', '/login')
  })

  it('redirects unauthenticated users from /rides/import to /login', async () => {
    window.history.replaceState({}, '', '/rides/import')

    render(<App />)

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('allows authenticated users to access /rides/import', async () => {
    sessionStorage.setItem(
      'bike_tracking_auth_session',
      JSON.stringify({ userId: 1, userName: 'Test Rider' })
    )
    window.history.replaceState({}, '', '/rides/import')

    render(<App />)

    expect(await screen.findByText('Import Rides Page')).toBeInTheDocument()
  })
})
