// import { useEffect, useState } from 'react'
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
import { MonthlyImportPage } from './pages/monthly-import/MonthlyImportPage'
import { ExpenseEntryPage } from './pages/expenses/ExpenseEntryPage'
import { ExpenseImportPage } from './pages/expenses/ExpenseImportPage'
import { ExpenseHistoryPage } from './pages/expenses/ExpenseHistoryPage'
import { AdvancedDashboardPage } from './pages/advanced-dashboard/advanced-dashboard-page'
// import { getPwaSnapshot, subscribePwaSnapshot } from './services/pwa/bootstrap'
import { ApiStartupGuard } from './components/api-startup-guard/ApiStartupGuard'

// function PwaStatusOutlet() {
//   const [snapshot, setSnapshot] = useState(() => getPwaSnapshot())

//   useEffect(() => {
//     return subscribePwaSnapshot((next) => {
//       setSnapshot(next)
//     })
//   }, [])

//   const messages: string[] = []

//   if (!snapshot.launchContext.isOnline) {
//     messages.push('Offline: network is required for ride operations in the installed app.')
//   }

//   if (snapshot.installationState.status === 'unavailable' && snapshot.installationState.reasonCode) {
//     messages.push(`Install unavailable (${snapshot.installationState.reasonCode.replace('_', ' ')}) in this environment.`)
//   }

//   if (snapshot.updateState.status === 'checking' || snapshot.updateState.status === 'downloading') {
//     messages.push('Checking for updates...')
//   }

//   if (snapshot.updateState.status === 'failed' && snapshot.updateState.failureReason) {
//     messages.push(`Update check failed: ${snapshot.updateState.failureReason}`)
//   }

//   if (messages.length === 0) {
//     return null
//   }

//   return (
//     <div aria-live="polite" role="status" style={{ padding: '0.5rem 1rem', backgroundColor: '#fff4e8', color: '#5a2f00' }}>
//       {messages.map((message) => (
//         <div key={message}>{message}</div>
//       ))}
//     </div>
//   )
// }

function App() {
  return (
    <ApiStartupGuard>
      <BrowserRouter>
        <AuthProvider>
          {/* TODO, fix it was stuck on checking for updates <PwaStatusOutlet /> */}
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/advanced" element={<AdvancedDashboardPage />} />
              <Route path="/miles" element={<MilesShellPage />} />
              <Route path="/rides/history" element={<HistoryPage />} />
              <Route path="/rides/record" element={<RecordRidePage />} />
              <Route path="/rides/import" element={<ImportRidesPage />} />
              <Route path="/import/monthly" element={<MonthlyImportPage />} />
              <Route path="/expenses/entry" element={<ExpenseEntryPage />} />
              <Route path="/expenses/import" element={<ExpenseImportPage />} />
              <Route path="/expenses/history" element={<ExpenseHistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ApiStartupGuard>
  )
}

export default App
