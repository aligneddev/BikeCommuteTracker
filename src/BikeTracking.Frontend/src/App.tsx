import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/auth-context'
import { ProtectedRoute } from './components/protected-route'
import { LoginPage } from './pages/login/login-page'
import { SignupPage } from './pages/signup/signup-page'
import { DashboardPage } from './pages/dashboard/dashboard-page'
import { MilesShellPage } from './pages/miles/miles-shell-page'
import { RecordRidePage } from './pages/RecordRidePage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { ImportRidesPage } from './pages/import-rides/ImportRidesPage'
import { ExpenseEntryPage } from './pages/expenses/ExpenseEntryPage'
import { ExpenseHistoryPage } from './pages/expenses/ExpenseHistoryPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/miles" element={<MilesShellPage />} />
            <Route path="/rides/history" element={<HistoryPage />} />
            <Route path="/rides/record" element={<RecordRidePage />} />
            <Route path="/rides/import" element={<ImportRidesPage />} />
            <Route path="/expenses/entry" element={<ExpenseEntryPage />} />
            <Route path="/expenses/history" element={<ExpenseHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
