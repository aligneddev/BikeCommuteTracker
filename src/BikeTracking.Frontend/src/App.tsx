import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/auth-context'
import { ProtectedRoute } from './components/protected-route'
import { LoginPage } from './pages/login/login-page'
import { SignupPage } from './pages/signup/signup-page'
import { MilesShellPage } from './pages/miles/miles-shell-page'
import { RecordRidePage } from './pages/RecordRidePage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/miles" element={<MilesShellPage />} />
            <Route path="/rides/record" element={<RecordRidePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
